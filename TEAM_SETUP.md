# MOTOFIX — Team Setup Guide

A step-by-step guide for the team to run the whole MOTOFIX platform on your own
machine. Everything runs in Docker, so you do **not** need to install Python,
Node, or PostgreSQL — just Docker and Git.

> If anything here doesn't work, message Elvis — don't fight it for an hour.

---

## What you'll end up with

Three apps running locally in your browser, backed by all the services + database:

| App | Open in your browser at |
|---|---|
| Driver app | http://localhost:8083 |
| Mechanic / provider app | http://localhost:8084 |
| Admin portal | http://localhost:8082 |

---

## 1. Install the two prerequisites

1. **Docker Desktop** — https://www.docker.com/products/docker-desktop/
   - After installing, **open it once** and wait until it says "Engine running".
   - On Windows it will ask to enable WSL 2 — say yes.
2. **Git** — https://git-scm.com/downloads

That's it. No Python, no Node, no database to install — Docker handles all of that.

---

## 2. Get the code

```bash
git clone https://github.com/elvis-kitonsa/motofix.git
cd motofix
```

(If Elvis sends the project as a zip instead, just unzip it and `cd` into the folder.)

---

## 3. Add the secret keys (the important step)

The app needs real API keys (Maps, Firebase, payments, AI). These are **not** in
the repo for security — so Elvis will send you a file called
**`motofix-env-bundle.zip`** privately (WhatsApp / Drive).

1. Put `motofix-env-bundle.zip` in the project folder (next to `docker-compose.yml`).
2. Run:

   ```powershell
   pwsh -File scripts/restore-env.ps1
   ```

   (On Mac/Linux, just unzip it into the project folder — it restores the `.env`
   files to the right places.)

Without this step the apps will build but logins, maps, and AI won't work.

---

## 4. Start everything

From the project folder:

```bash
docker compose up -d --build
```

- The **first** time, this downloads and builds everything — it takes about
  **10–15 minutes**. Grab a coffee. ☕ Later runs take seconds.
- `-d` runs it in the background; `--build` builds the apps with the keys you added.

When it finishes, open the apps from the table above. 🎉

To watch it come up or check a service:

```bash
docker compose ps                       # see what's running
docker compose logs -f dispatch-service # follow one service's logs
```

---

## 5. Day-to-day use

You only build once. After that:

```bash
docker compose up -d      # start everything (fast)
docker compose stop       # stop everything (frees your RAM, keeps data)
```

On Windows you can also just **double-click `start-motofix.bat`** — it wakes Docker
and all the containers for you.

After Elvis pushes new code, pull it and rebuild only what changed:

```bash
git pull
docker compose up -d --build
```

---

## Demo logins

Elvis will share the demo accounts (driver phone numbers, a mechanic SPN + password,
and the admin login). The database is seeded with sample data on first start, so
there's data to play with straight away.

---

## Troubleshooting

**"Network error / cannot reach server" in an app, or a service won't start**
The Postgres container sometimes reports "unhealthy" even though it's fine, which can
hold the other services back. Quickest fix — nudge everything to start:

```powershell
pwsh -File scripts/heal-services.ps1
```
or simply:
```bash
docker start motofix-postgres
docker compose up -d
```

**Docker Desktop is frozen / "engine not responding"**
Run the startup helper — it restarts the engine and the containers:
```powershell
pwsh -File start-motofix.ps1
```

**"port is already allocated" when starting**
Something else on your machine is using one of MOTOFIX's ports (8000–8008, 8082–8084,
or 5433). Close that program (a stray Postgres, another dev server, etc.) and retry.

**Start completely fresh (wipes the local database)**
```bash
docker compose down -v
docker compose up -d --build
```

**The apps load but maps/logins/AI fail**
You skipped step 3 — restore the `.env` bundle, then rebuild:
`docker compose up -d --build`.

---

## Handy reference

| Thing | Where |
|---|---|
| Driver / Provider / Admin apps | localhost **8083 / 8084 / 8082** |
| Backend services | localhost **8000–8008** (each has a `/health`) |
| Database (Postgres) | localhost **5433** (user `postgres`, password `password`) |
| All ports & architecture | [`README.md`](README.md) |
| Deeper ops notes | [`docs/RUNBOOK.md`](docs/RUNBOOK.md) |
