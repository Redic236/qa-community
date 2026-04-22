# syntax=docker/dockerfile:1.6
# Multi-stage build for the Q&A backend.
#  - builder: installs all deps (incl. dev) and runs `tsc`
#  - runtime: prod-only deps + compiled dist + source migrations + locales
#
# Migrations and the migrate runner stay in TypeScript and run via tsx at boot,
# which keeps a single source of truth without a parallel JS build pipeline.

ARG NODE_VERSION=20-alpine

# ─── builder ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts

RUN npm run build

# ─── runtime ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runtime
WORKDIR /app

# Tini reaps zombies when the container's PID 1 spawns a child for migrations.
# Netcat is used by the entrypoint to wait for MySQL to accept TCP connections.
RUN apk add --no-cache tini netcat-openbsd

ENV NODE_ENV=production \
    PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled app — `tsc` already copies the imported i18n JSON files alongside
# the emitted JS because they live under rootDir with resolveJsonModule on.
COPY --from=builder /app/dist ./dist
# Migrations stay as TS; entrypoint runs them via tsx
COPY --from=builder /app/migrations ./migrations
# Migrator runner needs its src counterparts (also TS, executed via tsx)
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/src/models ./src/models
COPY --from=builder /app/src/utils ./src/utils
COPY --from=builder /app/tsconfig.json ./tsconfig.json

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/app.js"]
