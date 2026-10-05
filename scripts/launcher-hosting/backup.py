#!/usr/bin/env python3
"""Private daily Neon backup with seven-day retention and optional recovery drill."""
import argparse
from datetime import datetime, timedelta, timezone
import json
import os
from pathlib import Path
import secrets

from verify import ROOT, client, load_env, pg_environment, sql


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-restore", action="store_true")
    options = parser.parse_args()
    evidence = ROOT / "evidence/launcher-token" / (
        "hosting-backup-verification.json" if options.verify_restore else "hosting-backup-last-run.json"
    )
    evidence.unlink(missing_ok=True)
    environment = pg_environment(load_env()["DATABASE_URL_DIRECT"], direct=True)
    destination = ROOT / ".scratch/hosting/backups"
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(destination, 0o700)
    stamp = datetime.now(timezone.utc)
    archive = destination / ("neon-" + stamp.strftime("%Y%m%dT%H%M%S") + ".dump")
    probe = "hosting_backup_" + secrets.token_hex(12)
    marker = secrets.token_hex(24)
    try:
        if options.verify_restore:
            sql(environment, f"CREATE SCHEMA {probe}; CREATE TABLE {probe}.marker(value text); INSERT INTO {probe}.marker VALUES ('{marker}')")
        dump = client(environment, ["pg_dump", "--format=custom", "--no-owner", "--no-acl"])
    finally:
        if options.verify_restore:
            sql(environment, f"DROP SCHEMA IF EXISTS {probe} CASCADE")
    with archive.open("xb") as file:
        os.chmod(archive, 0o600)
        file.write(dump)
    record = {"checked_at": stamp.isoformat(), "backup_created": True,
              "backup_bytes": archive.stat().st_size, "destination": ".scratch/hosting/backups",
              "retention_days": 7, "owner": "MrSufferer", "separate_database_restore_verified": False}
    if options.verify_restore:
        database = "hosting_restore_" + secrets.token_hex(12)
        restored = {**environment, "PGDATABASE": database}
        try:
            sql(environment, "CREATE DATABASE " + database)
            client(restored, ["pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "--dbname=" + database], archive.read_bytes())
            if sql(restored, f"SELECT value FROM {probe}.marker") != marker:
                raise RuntimeError("Restored marker differs")
            record["restored_marker_verified"] = True
            record["source_probe_removed"] = sql(environment, f"SELECT count(*) FROM pg_namespace WHERE nspname = '{probe}'") == "0"
            if not record["source_probe_removed"]:
                raise RuntimeError("Source probe cleanup not verified")
            # Dump again to establish readable recovered data/schema, without
            # publishing table names or records from the private database.
            client(restored, ["pg_dump", "--format=custom", "--no-owner", "--no-acl"])
            record["separate_database_restore_verified"] = True
        finally:
            sql(environment, "DROP DATABASE IF EXISTS " + database + " WITH (FORCE)")
        record["restore_database_removed"] = sql(environment, f"SELECT count(*) FROM pg_database WHERE datname = '{database}'") == "0"
        if not record["restore_database_removed"]:
            raise RuntimeError("Disposable restore target cleanup not verified")
    cutoff = stamp - timedelta(days=7)
    for previous in destination.glob("neon-*.dump"):
        if datetime.fromtimestamp(previous.stat().st_mtime, timezone.utc) < cutoff:
            previous.unlink()
    evidence.write_text(json.dumps(record, indent=2) + "\n")
    print("Private backup saved; separate-target recovery " + ("verified" if options.verify_restore else "not requested"))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Backup failed: " + type(error).__name__ + "; private diagnostic details suppressed")
        raise SystemExit(1)
