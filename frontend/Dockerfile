# syntax=docker/dockerfile:1.6
# Multi-stage frontend build:
#  - builder: vite + tsc → static dist/
#  - runtime: nginx:alpine serving static files, proxying /api → backend

ARG NODE_VERSION=20-alpine

# ─── builder ────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# ─── runtime ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
