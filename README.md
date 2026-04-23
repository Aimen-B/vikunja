# Vikunja Source Deployment Repo

This repository contains the full Vikunja source tree plus a simple Docker-based workflow for two cases:

1. Local development with `docker compose`
2. Deployment on Coolify with the Docker Compose build pack

The app is built from source inside Docker. It does not use the official prebuilt Vikunja image as the main runtime.

## Repo Structure

```text
.
├── Dockerfile
├── docker-compose.yml
├── docker-compose.coolify.yml
├── .env.example
├── frontend/
├── pkg/
├── main.go
└── ...
```

## Tradeoffs

- This setup rebuilds the app image after code changes instead of trying to hot-reload both the Go backend and Vite frontend inside containers.
- That makes local iteration slower than a dedicated live-reload dev stack, but it keeps the structure simple and keeps the same source-build path for local use and Coolify.
- PostgreSQL and uploads are persisted with Docker volumes so local restarts and redeploys do not wipe state.

## Local Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set at least:

   - `VIKUNJA_SERVICE_SECRET`
   - `POSTGRES_PASSWORD`
   - `VIKUNJA_SERVICE_PUBLICURL`

   For local use, `VIKUNJA_SERVICE_PUBLICURL=http://localhost:3456` is fine.

3. Build and start the stack:

   ```bash
   docker compose up -d --build
   ```

4. Open:

   ```text
   http://localhost:3456
   ```

5. Watch logs if needed:

   ```bash
   docker compose logs -f app
   ```

## How To Edit The Code

- Backend code lives mainly in `pkg/` and `main.go`.
- Frontend code lives in `frontend/`.
- The Docker image builds the frontend first, copies `frontend/dist` into the Go build, and then compiles the Vikunja binary.

Make your code changes normally in this repo. It is a standard Git checkout, so you can edit, commit, branch, and push it like any other repository.

## How To Rebuild After Code Changes

After changing Go or frontend code:

```bash
docker compose build app
docker compose up -d app
```

If you changed dependencies or want a full rebuild:

```bash
docker compose up -d --build
```

If you want to stop the stack:

```bash
docker compose down
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

Use `docker-compose.coolify.yml` with Coolify's Docker Compose build pack.

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
