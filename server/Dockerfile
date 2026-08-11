# ── 构建阶段 ─────────────────────────────────────────────────
FROM node:24-bookworm-slim AS builder

WORKDIR /app/server

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY server/package.json server/package-lock.json ./
RUN npm ci

COPY server/ .
RUN npm run build && npm prune --omit=dev

# ── 生产阶段 ─────────────────────────────────────────────────
FROM node:24-bookworm-slim AS production

WORKDIR /app

# Only copy compiled output and runtime dependencies
COPY --from=builder --chown=node:node /app/server/dist ./dist
COPY --from=builder --chown=node:node /app/server/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/server/package.json ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown node:node /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_DIR=/app/data

USER node

CMD ["node", "dist/app.js"]
