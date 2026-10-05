# Launcher Token hosting prerequisite

Status: infrastructure reserved and private database recovery verified; application deployment remains deferred.

Source: [Provide durable hosting and verify persistence](https://github.com/MrSufferer/whatelse/issues/28).

## Provisioned destinations

Owner/operator: **MrSufferer**. Render workspace: `tea-cspsq3ggph6c73f4ln6g`.

| Destination | Provisioned address | Configuration |
| --- | --- | --- |
| Worker/read API | https://launcher-beta-api.onrender.com | Render Free web service, Singapore, suspended |
| Frontend | https://launcher-beta-frontend.onrender.com | Render Free web service, Singapore, suspended |
| Durable SQL | `ep-restless-meadow-az8ec4pf.c-3.ap-southeast-1.aws.neon.tech` | Existing user-supplied Neon PostgreSQL 18 database, TLS required |

Neon replaces SQLite because Render Free has an ephemeral filesystem and cannot attach a persistent disk. The database credentials were supplied by the user; no Neon account management access was supplied. Neon account-level billing/ownership is not independently inspected.

Both Render services use the infrastructure-only `hosting-reservation` branch because the remote repository was empty. That branch contains only a reservation README. Initial builds were canceled, autodeploy is off, and both services are suspended. These URLs reserve destinations; they do not serve an application. Existing unrelated Render services are untouched.

API root directory is reserved as `services/launcher-api`; frontend as `packages/nextjs`. Their provisional Node/Next build/start configuration must be reconciled with the actual Scaffold-ETH workspace during implementation. Before activation, point the services at the reviewed application branch, validate monorepo paths/commands, and resume only under deployment authorization. No contract deployment or real-funds release is authorized here.

## Free-tier ingestion decision

Use one bounded ingestion loop inside the API web service. On wake/start, resume from the durable SQL cursor; while awake, ingest bounded log ranges and atomically persist canonical progress. Read requests may wake the service and trigger catch-up, but must not wait for a complete historical replay. Return freshness/syncing/unavailable metadata and suspend misleading rankings until canonical progress is current. Serialize ingestion through the durable database so concurrent wake/read requests cannot create competing workers.

This is the worker hosting configuration for the later discovery slice, not an implemented ingestion worker. Render Free sleeps after 15 minutes without incoming traffic and provides no free background-worker service. There is no always-on ingestion or keep-alive workaround. Frontend and API share the workspace's free instance-hour allowance with its other services; quota exhaustion can suspend service. Operational beta readiness must assess the resulting freshness and availability limits.

## Private credential and access handoff

Root `.env` contains the Render management API key and Neon pooled/direct URLs. The provisioner also generates independent `SESSION_SECRET` and `ACCESS_TOKEN_SECRET` values, persists them locally with mode `0600`, and stores them privately on Render.

The API is linked to environment group `launcher-beta-private` (`evg-db1soa7avr4c73dd2mn0`), containing `DATABASE_URL`, `SESSION_SECRET` and `ACCESS_TOKEN_SECRET`. The frontend receives only the two server session/access secrets, without database credentials. Database direct access remains local for backup/restore. The Render API key is not an application runtime secret. None of these values use `NEXT_PUBLIC_` names or belong in browser bundles.

Access configuration: server-issued signed sessions and invitation/access tokens using separate secrets, with participant admission enforced by the later application workflow. Secret storage is provisioned; authentication is not implemented by this prerequisite. Never log secret values or put them in public issues/evidence. `.env` and `.scratch/hosting/` are Git-ignored.

## Backup policy and verification

Owner: **MrSufferer**. Destination: `.scratch/hosting/backups` on this Mac, outside Render's ephemeral filesystem, mode `0700`; dumps are mode `0600`. PostgreSQL 18 `pg_dump` clients run in disposable Docker containers against Neon's direct TLS endpoint. Retention is seven days, pruned after a successful backup. Dumps contain private data and must never be committed.

User LaunchAgent `com.whatelse.launcher-neon-backup` runs daily at **03:00 local time**. The installed plist is in `~/Library/LaunchAgents/`; it contains paths and a schedule, no credentials. The job was started through launchd and exited successfully. It needs this user session/Mac and Docker available. This is a local prerequisite backup path, not an offsite disaster-recovery guarantee; beta operating readiness must revisit reliability, independent storage and restore frequency.

Verification established:

- A random throwaway marker survived the writer-container/process exit and was read by a fresh pooled client process.
- Its schema-only backup restored after dropping only that random schema; the probe and private temporary dump were removed.
- A complete database backup was saved privately, restored into a separately created disposable database, and its throwaway marker read back successfully before dumping again. The source probe and disposable restore database were removed. The database is presently empty of application records, so this proves the recovery mechanism rather than an application's future data model.
- Render services remain suspended; their only initial deployments are canceled.

A hosted application's restart/replay behavior belongs to the later implementation verification; none is claimed here. Neon's short Free instant-restore history does not replace the local backup policy.

## Repeatable operations

With Docker running and root `.env` populated:

```sh
python3 scripts/launcher-hosting/provision.py
python3 scripts/launcher-hosting/verify.py
python3 scripts/launcher-hosting/backup.py
python3 scripts/launcher-hosting/backup.py --verify-restore
```

`provision.py` reuses the named infrastructure, refuses differing secret groups or non-free services, and keeps destinations suspended. `verify.py` uses an isolated random schema and saves sanitized evidence; failed reruns clear its old result. `backup.py --verify-restore` uses a random source marker schema and a randomly named restore database, and removes both. Failed runs clear the corresponding prior success evidence. Daily backup evidence is separate from recovery-drill evidence.

To inspect the scheduled job: `launchctl print gui/$(id -u)/com.whatelse.launcher-neon-backup`. To run it now: `launchctl kickstart gui/$(id -u)/com.whatelse.launcher-neon-backup`. To disable it: `launchctl bootout gui/$(id -u)/com.whatelse.launcher-neon-backup`; the private dumps and plist remain until explicitly removed.

Sanitized evidence lives in `evidence/launcher-token/hosting-verification.json`, `hosting-provisioning.json`, `hosting-backup-verification.json` and `hosting-backup-schedule.json`.

## Documentation checked

- [Render Free limits](https://render.com/docs/free)
- [Render service API](https://api-docs.render.com/reference/create-service)
- [Render environment groups](https://api-docs.render.com/reference/create-env-group)
- [Neon plans](https://neon.com/docs/introduction/plans)
- [Supabase pricing](https://supabase.com/pricing)
