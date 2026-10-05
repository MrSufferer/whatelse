#!/usr/bin/env python3
"""Reserve free Render destinations, disable deployment, and store secrets privately."""
import json
import os
from pathlib import Path
import secrets
import urllib.error
import urllib.request

from verify import ROOT, load_env


def api(token, path, body=None, method=None):
    request = urllib.request.Request(
        "https://api.render.com/v1/" + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method or ("POST" if body is not None else "GET"),
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=40) as response:
            content = response.read()
            return json.loads(content) if content else None
    except urllib.error.HTTPError as error:
        # Provider response bodies may echo partial or escaped credentials.
        raise RuntimeError(f"Render operation returned HTTP {error.code}; private details suppressed") from None


def main():
    values = load_env()
    token = values["RENDER_API_KEY"]
    owners = api(token, "owners?limit=100")
    if len(owners) != 1:
        raise RuntimeError("Expected exactly one authorized Render workspace")
    owner = owners[0]["owner"]["id"]
    envfile = ROOT / ".env"
    os.chmod(envfile, 0o600)
    with envfile.open("a") as file:
        for key in ("SESSION_SECRET", "ACCESS_TOKEN_SECRET"):
            if not values.get(key):
                values[key] = secrets.token_urlsafe(48)
                file.write(f"\n{key}={values[key]}\n")
    output = ROOT / "evidence/launcher-token/hosting-provisioning.json"
    evidence = {"owner_id": owner, "operator": "MrSufferer", "services": [], "application_deployed": False}

    def save():
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(evidence, indent=2) + "\n")

    groups = [entry["envGroup"] for entry in api(token, "env-groups?limit=100")]
    matching = [g for g in groups if g.get("name") == "launcher-beta-private"]
    if matching:
        group_id = matching[0]["id"]
        stored = api(token, "env-groups/" + group_id)
        stored_values = {v["key"]: v["value"] for v in stored.get("envVars", [])}
        if any(stored_values.get(k) != values[k] for k in ("DATABASE_URL", "SESSION_SECRET", "ACCESS_TOKEN_SECRET")):
            raise RuntimeError("Existing secret group differs; refusing to overwrite it")
    else:
        group = api(token, "env-groups", {
            "name": "launcher-beta-private", "ownerId": owner,
            "envVars": [{"key": k, "value": values[k]} for k in ("DATABASE_URL", "SESSION_SECRET", "ACCESS_TOKEN_SECRET")],
        })
        group_id = group["id"]
    evidence["private_env_group_id"] = group_id
    save()
    print("Private Render secret group configured", flush=True)
    existing = api(token, "services?limit=100")
    for name, rootdir, build, start in (
        ("launcher-beta-api", "services/launcher-api", "npm ci", "npm start"),
        ("launcher-beta-frontend", "packages/nextjs", "corepack enable && yarn install --immutable && yarn build", "yarn start --hostname 0.0.0.0 --port $PORT"),
    ):
        matches = [x["service"] for x in existing if x["service"]["name"] == name]
        if matches:
            service = matches[0]
            if service.get("ownerId") != owner or service.get("repo") != "https://github.com/MrSufferer/whatelse":
                raise RuntimeError("Existing service ownership/source mismatch")
            if service["serviceDetails"].get("plan") != "free":
                raise RuntimeError("Existing service is not on the free plan")
        else:
            created = api(token, "services", {
                "type": "web_service", "name": name, "ownerId": owner,
                "repo": "https://github.com/MrSufferer/whatelse", "branch": "hosting-reservation",
                "rootDir": rootdir, "autoDeployTrigger": "off",
                "serviceDetails": {"runtime": "node", "plan": "free", "region": "singapore",
                                   "envSpecificDetails": {"buildCommand": build, "startCommand": start}},
            })
            service = created["service"] if "service" in created else created
        sid = service["id"]
        evidence["services"].append({"id": sid, "name": name, "plan": "free", "region": "singapore",
                                      "root_dir": rootdir, "url": service["serviceDetails"].get("url"),
                                      "suspended": False, "auto_deploy": "off"})
        save()
        # Reserve only: cancel the initial build before parking the destination.
        for entry in api(token, f"services/{sid}/deploys?limit=20"):
            deploy = entry["deploy"]
            if deploy["status"] in ("created", "queued", "build_in_progress", "update_in_progress", "pre_deploy_in_progress"):
                api(token, f"services/{sid}/deploys/{deploy['id']}/cancel", method="POST")
        if service.get("suspended") != "suspended":
            api(token, f"services/{sid}/suspend", method="POST")
        actual = api(token, "services/" + sid)
        if actual.get("suspended") != "suspended":
            raise RuntimeError("Service suspension could not be verified")
        if actual.get("autoDeployTrigger") != "off" or actual["serviceDetails"].get("plan") != "free":
            raise RuntimeError("Free plan and disabled autodeploy could not be verified")
        deployments = api(token, f"services/{sid}/deploys?limit=20")
        if any(d["deploy"]["status"] == "live" for d in deployments):
            raise RuntimeError("Unexpected live deployment; inspect reserved service")
        evidence["services"][-1]["suspended"] = True
        evidence["services"][-1]["deployment_states"] = [d["deploy"]["status"] for d in deployments]
        if name == "launcher-beta-api":
            api(token, f"env-groups/{group_id}/services/{sid}", method="POST")
            evidence["services"][-1]["private_secret_group_linked"] = True
        else:
            # Frontend server gets session material, never the database password.
            variables = api(token, f"services/{sid}/env-vars?limit=100")
            current = {item["envVar"]["key"]: item["envVar"]["value"] for item in variables}
            for key in ("SESSION_SECRET", "ACCESS_TOKEN_SECRET"):
                current[key] = values[key]
            api(token, f"services/{sid}/env-vars", [{"key": k, "value": v} for k, v in current.items()], method="PUT")
            evidence["services"][-1]["server_session_secrets_configured"] = True
        save()
        print(name + " reserved and suspended", flush=True)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(str(error))
        raise SystemExit(1)
    except Exception as error:
        print("Provisioning failed: " + type(error).__name__ + "; private details suppressed")
        raise SystemExit(1)
