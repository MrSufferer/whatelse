#!/usr/bin/env python3
"""Verify private Render/Neon credentials and isolated PostgreSQL recovery.

Requires Docker. Uses PostgreSQL 18 clients in disposable containers, creates
only a random probe schema, and removes it on success or failure. Credentials
are passed through environment variables and never printed or saved as evidence.
"""

import json
import os
from pathlib import Path
import secrets
import shlex
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone


ROOT = Path(__file__).resolve().parents[2]
CLIENT_IMAGE = "postgres:18"


def load_env():
    values = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator:
            raise ValueError("Invalid .env assignment")
        words = shlex.split(value, comments=True)
        if len(words) > 1:
            raise ValueError("Quote .env values containing spaces")
        values[key.strip()] = words[0] if words else ""
    for key in ("RENDER_API_KEY", "DATABASE_URL", "DATABASE_URL_DIRECT"):
        if not values.get(key):
            raise ValueError("Missing credential: " + key)
    return values


def pg_environment(url, direct=False):
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError("Expected a PostgreSQL connection URL")
    if not parsed.hostname or not parsed.hostname.endswith(".neon.tech"):
        raise ValueError("This probe is restricted to Neon databases")
    if not parsed.username or not parsed.password or not parsed.path.strip("/"):
        raise ValueError("Database URL requires user, password and database")
    query = urllib.parse.parse_qs(parsed.query)
    sslmode = query.get("sslmode", ["require"])[0]
    if sslmode not in ("require", "verify-ca", "verify-full"):
        raise ValueError("Database connection must require TLS")
    environment = {
        "PGHOST": parsed.hostname.replace("-pooler", "") if direct else parsed.hostname,
        "PGPORT": str(parsed.port or 5432),
        "PGUSER": urllib.parse.unquote(parsed.username),
        "PGPASSWORD": urllib.parse.unquote(parsed.password),
        "PGDATABASE": urllib.parse.unquote(parsed.path.lstrip("/")),
        "PGSSLMODE": sslmode,
        "PGCONNECT_TIMEOUT": "20",
    }
    if query.get("channel_binding"):
        environment["PGCHANNELBINDING"] = query["channel_binding"][0]
    return environment


def client(environment, arguments, data=None):
    container = "launcher-hosting-" + secrets.token_hex(12)
    command = ["docker", "run", "--name", container, "--rm", "-i"]
    for key in environment:
        command.extend(["--env", key])
    command.extend([CLIENT_IMAGE, *arguments])
    try:
        result = subprocess.run(
            command, env={**os.environ, **environment}, input=data,
            capture_output=True, timeout=180,
        )
    finally:
        # Killing the CLI on timeout does not necessarily stop its container.
        subprocess.run(
            ["docker", "rm", "--force", container], capture_output=True, timeout=30,
        )
    if result.returncode:
        # Database errors can contain credentials or application data.
        raise RuntimeError(arguments[0] + " failed; diagnostic output suppressed")
    return result.stdout


def sql(environment, statement):
    return client(
        environment, ["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement]
    ).decode().strip()


def render_get(token, endpoint):
    request = urllib.request.Request(
        "https://api.render.com/v1/" + endpoint,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    target = ROOT / "evidence/launcher-token/hosting-verification.json"
    # A failed rerun must not leave an old successful result at this path.
    target.unlink(missing_ok=True)
    values = load_env()
    owners = render_get(values["RENDER_API_KEY"], "owners?limit=100")
    # Read access only: no services or application deployments are created here.
    services = render_get(values["RENDER_API_KEY"], "services?limit=100")
    direct = pg_environment(values["DATABASE_URL_DIRECT"], direct=True)
    pooled = pg_environment(values["DATABASE_URL"])
    schema = "hosting_probe_" + secrets.token_hex(12)
    marker = secrets.token_hex(24)
    evidence = {
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "render_account_access": True,
        "render_owner_ids": [entry["owner"]["id"] for entry in owners],
        "render_service_count_first_page": len(services),
        "database_provider": "Neon",
        "database_host": direct["PGHOST"],
        "database_tls_required": True,
        "direct_endpoint_derived_from_pooled": "-pooler" in urllib.parse.urlsplit(values["DATABASE_URL_DIRECT"]).hostname,
        "client_image": CLIENT_IMAGE,
        "hosted_api_restart_verified": False,
        "operational_backup_policy_verified": False,
        "application_deployed": False,
        "restore_scope": "random probe schema in the same database",
    }
    print("Render account access verified", flush=True)
    sql(pooled, "SELECT 1")
    evidence["pooled_connection_verified"] = True
    evidence["database_version"] = sql(direct, "SHOW server_version")
    print("Neon pooled and direct connections verified", flush=True)
    try:
        # Generated identifiers/marker contain only fixed prefixes and hex.
        sql(direct, f"CREATE SCHEMA {schema}")
        sql(direct, f"CREATE TABLE {schema}.probe (marker text PRIMARY KEY); INSERT INTO {schema}.probe VALUES ('{marker}')")
        # Each client call runs in a new container/process. The writer has exited.
        if sql(pooled, f"SELECT marker FROM {schema}.probe") != marker:
            raise RuntimeError("Marker did not survive client process restart")
        evidence["client_process_restart_verified"] = True
        print("Marker survived writer process exit and fresh pooled read", flush=True)
        with tempfile.TemporaryDirectory(prefix="launcher-hosting-") as directory:
            dump = client(direct, ["pg_dump", "--format=custom", "--no-owner", "--no-acl", "--schema=" + schema])
            archive = Path(directory) / "probe.dump"
            archive.touch(mode=0o600)
            archive.write_bytes(dump)
            sql(direct, f"DROP SCHEMA {schema} CASCADE")
            client(direct, ["pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "--dbname=" + direct["PGDATABASE"]], archive.read_bytes())
            if sql(direct, f"SELECT marker FROM {schema}.probe") != marker:
                raise RuntimeError("Restored marker mismatch")
            evidence["isolated_schema_backup_restore_verified"] = True
            print("Isolated schema backup/restore verified", flush=True)
    finally:
        # CREATE may have committed even if its client timed out.
        sql(direct, f"DROP SCHEMA IF EXISTS {schema} CASCADE")
    evidence["probe_removed"] = sql(direct, f"SELECT count(*) FROM information_schema.schemata WHERE schema_name = '{schema}'") == "0"
    if not evidence["probe_removed"]:
        raise RuntimeError("Probe cleanup could not be verified")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(evidence, indent=2) + "\n")
    print("Probe removed; sanitized evidence saved", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Verification stopped: " + type(error).__name__ + ". Private diagnostic details suppressed.", file=sys.stderr)
        sys.exit(1)
