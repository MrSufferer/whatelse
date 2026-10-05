# Launcher Token hosting prerequisite

Status: selected providers; provisioning and persistence verification pending.

Source: [Provide durable hosting and verify persistence](https://github.com/MrSufferer/whatelse/issues/28).

## Destinations

- Render Free web service for the future API. Its filesystem is disposable.
- Neon Free Postgres for durable ingestion progress and offchain records. This explicitly replaces SQLite because Render Free cannot attach persistent disks.
- Frontend destination: a second Render Free web service for Scaffold-ETH's Next.js application. A static site is suitable only if a later implementation explicitly supports static export. Build/start commands and service URL remain pending scaffolding.
- Service URLs, account owners and regions must be recorded after provisioning. Nothing has been provisioned or deployed by this document.

Render Free sleeps after 15 minutes without incoming traffic. It supplies neither a free background-worker service nor an always-on ingestion process. A later ingestion slice must choose and verify a wake/catch-up strategy or revisit compute hosting; do not claim continuous freshness.

## Private handoff

In Neon, create a Free project in a region near the Render service. From the project's Connect dialog, copy the pooled connection into `DATABASE_URL` and the non-pooled connection into `DATABASE_URL_DIRECT` in the repository-root `.env`. Retain the provider's TLS parameters. Put `RENDER_API_KEY` there too. `NEON_API_KEY` is optional for API-managed branch/project operations.

The root `.gitignore` excludes `.env` and `.env.*` except `.env.example`. No credentials belong in public issues, evidence, logs, frontend build variables or commits. Render's environment-secret configuration is the eventual runtime destination for database and access/session secrets; the Render management API key is local provisioning access, not an application runtime secret. Generate a separate session secret when the application's authentication interface is established.

## Verification still required

Use an isolated probe schema and random marker, without touching application tables. Commit the marker, terminate the client process, and confirm it from a new process. If an API probe is provisioned, restart that process and confirm it reads the same marker; a new local database connection alone does not prove a hosted API restart.

The preliminary probe uses the direct connection and PostgreSQL 18 clients in disposable Docker containers to export only its randomly named schema in custom format. It drops only that schema, restores it in the same database, confirms the marker, then removes the schema and private temporary dump. This proves a narrow schema backup/restore without overwriting application tables; it does not establish recovery into a separate destination. Operational recovery must additionally restore an application backup into a disposable database or Neon branch. Never run database-wide cleanup against the live database.

Neon's short Free instant-restore window is not a complete operational backup policy. Before closing the prerequisite, choose a private backup destination, schedule, retention and owner, and demonstrate restore from that destination. Backups on Render's ephemeral filesystem are insufficient.

## Documentation checked

- [Render Free limits](https://render.com/docs/free)
- [Neon plans](https://neon.com/docs/introduction/plans)
- [Neon PostgreSQL import and restore](https://neon.com/docs/import/import-from-postgres)
- [Supabase pricing](https://supabase.com/pricing)

Provider selection does not establish persistence evidence, operational readiness or real-funds authorization. Keep the issue open until its acceptance criteria are verified.

## Run the preliminary verification

With Docker running and the root `.env` populated, run `python3 scripts/launcher-hosting/verify.py`. The script does not deploy an application or mutate Render services. If `DATABASE_URL_DIRECT` contains Neon's `-pooler` hostname, the verifier derives the direct hostname in memory and records that correction without changing `.env`.

Successful runs write sanitized results to `evidence/launcher-token/hosting-verification.json`. Each run clears the previous result before attempting verification, so failed reruns cannot leave stale passes. Review that evidence for what was actually proved; the hosted API restart and operational backup-policy flags remain false.
