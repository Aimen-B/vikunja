# Vikunja Source Deployment Repo

This repository contains the full Vikunja source tree plus a Docker-based workflow for three cases:

1. Local production-like runs with `docker compose`
2. Local hot reload with `docker compose` and mounted source
3. Deployment on Coolify with the Docker Compose build pack

The app is built from source inside Docker. It does not use the official prebuilt Vikunja image as the main runtime.

## Repo Structure

```text
.
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── docker-compose.coolify.yml
├── .air.toml
├── .env.example
├── frontend/
├── pkg/
├── main.go
└── ...
```

## Tradeoffs

- The default `docker-compose.yml` stays close to production and rebuilds from source into the runtime image.
- Hot reload lives in `docker-compose.dev.yml`, so local iteration is fast without leaking dev-only tooling into Coolify.
- PostgreSQL and uploads are persisted with Docker volumes so local restarts and redeploys do not wipe state.

## Local Setup

### Production-like local run

1. Copy the example environment file:

   ```bash`
   cp .env.example .env
   ```

2. Edit `.env` and set at least:

   - `VIKUNJA_SERVICE_SECRET`
   - `POSTGRES_PASSWORD`
   - `VIKUNJA_SERVICE_PUBLICURL`

   For local use, `VIKUNJA_SERVICE_PUBLICURL=http://localhost:3456` is fine.

3. Build and start the stack with attached logs:

   ```bash`
   docker compose up --build
   ```

4. Open:

   ```text
   http://localhost:3456
   ```

5. Stop the stack with `Ctrl+C`.

### Local hot reload

Use the dev overlay when you want Go auto-reload and Vue HMR:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This starts:

- `app` on `http://localhost:3456`
- `frontend` on `http://localhost:4173`
- `postgres` with the same persistent database volume

For hot reload, set these in `.env`:

```dotenv
VIKUNJA_FRONTEND_PORT=4173
VIKUNJA_DEV_PUBLICURL=http://localhost:4173
```

In dev mode, the browser should use `http://localhost:4173` while the backend keeps running on `http://localhost:3456` behind Vite's proxy.

### If port 3456 is already taken

Change the app port in `.env`:

```dotenv
VIKUNJA_APP_PORT=3457
VIKUNJA_SERVICE_PUBLICURL=http://localhost:3457
```

Or stop the container already using that port before starting this stack.

## How To Edit The Code

- Backend code lives mainly in `pkg/` and `main.go`.
- Frontend code lives in `frontend/`.
- The Docker image builds the frontend first, copies `frontend/dist` into the Go build, and then compiles the Vikunja binary.
- The hot-reload stack mounts the repo into the backend and frontend dev containers so you can edit the source directly in this checkout.

Make your code changes normally in this repo. It is a standard Git checkout, so you can edit, commit, branch, and push it like any other repository.

## How To Rebuild After Code Changes

For the production-like compose stack:

```bash
docker compose build app
docker compose up app
```

If you changed dependencies or want a full rebuild:

```bash
docker compose up --build
```

If you want to stop the stack:

```bash
docker compose down
```

For the hot-reload stack, code changes are picked up automatically:

- Go changes restart the backend through `air`
- Vue, TypeScript, and style changes refresh through Vite HMR

Rebuild the hot-reload containers only when dependencies or Docker targets change:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The following data stays persisted in Docker volumes:

- PostgreSQL data
- Vikunja uploaded files

## How To Push To GitHub

This checkout starts with the upstream Vikunja repository as `origin`. If you want to push this customized setup to your own GitHub repository while keeping upstream available:

```bash
git remote rename origin upstream
git remote add origin git@github.com:YOUR_GITHUB_USER/YOUR_REPO.git
git push -u origin main
```

If you prefer HTTPS:

```bash
git remote rename origin upstream
git remote add origin https://github.com/YOUR_GITHUB_USER/YOUR_REPO.git
git push -u origin main
```

## How To Deploy On Coolify

Use `docker-compose.coolify.yml` with Coolify's Docker Compose build pack. The dev overlay is local-only and should not be used in Coolify.

### Coolify Steps

1. Push this repository to GitHub.
2. In Coolify, create a new resource from that GitHub repository.
3. Choose the `Docker Compose` build pack.
4. Set `Base Directory` to `/`.
5. Set `Docker Compose Location` to `/docker-compose.coolify.yml`.
6. Continue so Coolify parses the services.
7. Set the required environment variables in Coolify.
8. Assign your domain to the `app` service.

Because Vikunja listens on container port `3456`, set the domain on the `app` service with that container port in mind. A practical example is:

```text
https://vikunja.example.com:3456
```

Coolify uses that port to route traffic to the container while still exposing the site on the normal public HTTP/HTTPS ports through its proxy.

9. Deploy the stack.

### Exact Environment Variables To Set In Coolify

Set these in Coolify for the `docker-compose.coolify.yml` deployment:

- `VIKUNJA_SERVICE_PUBLICURL`
- `VIKUNJA_SERVICE_SECRET`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Optional but useful overrides:

- `VIKUNJA_SERVICE_ENABLEREGISTRATION`
- `VIKUNJA_SERVICE_TIMEZONE`
- `VIKUNJA_LOG_LEVEL`
- `VIKUNJA_DATABASE_SSLMODE`
- `VIKUNJA_DATABASE_MAXOPENCONNECTIONS`
- `VIKUNJA_DATABASE_MAXIDLECONNECTIONS`
- `VIKUNJA_DATABASE_MAXCONNECTIONLIFETIME`
- `VIKUNJA_RELEASE_VERSION`

### Recommended Coolify Values

```text
VIKUNJA_SERVICE_PUBLICURL=https://vikunja.example.com
VIKUNJA_SERVICE_SECRET=<long-random-secret>
POSTGRES_DB=vikunja
POSTGRES_USER=vikunja
POSTGRES_PASSWORD=<strong-password>
VIKUNJA_SERVICE_ENABLEREGISTRATION=false
VIKUNJA_SERVICE_TIMEZONE=UTC
VIKUNJA_LOG_LEVEL=INFO
VIKUNJA_DATABASE_SSLMODE=disable
VIKUNJA_DATABASE_MAXOPENCONNECTIONS=25
VIKUNJA_DATABASE_MAXIDLECONNECTIONS=25
VIKUNJA_DATABASE_MAXCONNECTIONLIFETIME=10000
VIKUNJA_RELEASE_VERSION=coolify
```

## Notes About Reverse Proxies

- Vikunja runs on `:3456` inside the container.
- `VIKUNJA_SERVICE_PUBLICURL` should always be the external URL users actually visit.
- For local use, that is usually `http://localhost:3456`.
- For Coolify, that should be your real public HTTPS URL, for example `https://vikunja.example.com`.

## References

- Vikunja project: https://github.com/go-vikunja/vikunja
- Coolify Docker Compose build pack docs: https://coolify.io/docs/applications/build-packs/docker-compose
- Coolify Docker Compose knowledge base: https://coolify.io/docs/knowledge-base/docker/compose
