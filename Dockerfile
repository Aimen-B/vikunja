# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=24.13.0
ARG GO_VERSION=1.25.7

FROM node:${NODE_VERSION}-alpine AS frontend-builder

WORKDIR /src/frontend

ENV PNPM_CACHE_FOLDER=/pnpm/store
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CYPRESS_INSTALL_BINARY=0

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/.npmrc ./

RUN npm install -g corepack && corepack enable && pnpm install --frozen-lockfile

COPY frontend/ ./

ARG RELEASE_VERSION=dev

RUN printf '{\n  "VERSION": "%s"\n}\n' "${RELEASE_VERSION}" > src/version.json \
    && pnpm run build

FROM golang:${GO_VERSION}-alpine AS backend-builder

WORKDIR /src

RUN apk add --no-cache ca-certificates git

COPY go.mod go.sum ./
RUN go mod download

COPY . ./
COPY --from=frontend-builder /src/frontend/dist ./frontend/dist

ARG RELEASE_VERSION=dev

ENV CGO_ENABLED=0

RUN go build \
    -tags "osusergo" \
    -ldflags "-s -w -X code.vikunja.io/api/pkg/version.Version=${RELEASE_VERSION} -X main.Tags=osusergo" \
    -o /out/vikunja \
    .

RUN mkdir -p /out/rootfs/app/vikunja/files /out/rootfs/tmp \
    && chmod 1777 /out/rootfs/tmp

FROM scratch AS runtime

LABEL org.opencontainers.image.authors="maintainers@vikunja.io"
LABEL org.opencontainers.image.documentation="https://vikunja.io/docs"
LABEL org.opencontainers.image.licenses="AGPL-3.0-or-later"
LABEL org.opencontainers.image.source="https://github.com/go-vikunja/vikunja"
LABEL org.opencontainers.image.title="Vikunja"
LABEL org.opencontainers.image.url="https://vikunja.io"

WORKDIR /app/vikunja

COPY --from=backend-builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=backend-builder /out/rootfs/tmp /tmp
COPY --from=backend-builder --chown=1000:1000 /out/rootfs/app/vikunja /app/vikunja
COPY --from=backend-builder --chown=1000:1000 /out/vikunja /app/vikunja/vikunja

USER 1000:1000

ENV VIKUNJA_SERVICE_ROOTPATH=/app/vikunja

EXPOSE 3456

ENTRYPOINT ["/app/vikunja/vikunja"]
