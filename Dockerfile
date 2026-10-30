# syntax=docker/dockerfile:1.7

# ---------------------------------------------------------------------------
# Etapa 1: dependencias de producción
# ---------------------------------------------------------------------------
FROM node:24-alpine AS dependencies

WORKDIR /app

# Versión fijada para builds reproducibles
RUN npm install -g pnpm@11.25.0

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm install --prod --frozen-lockfile

# ---------------------------------------------------------------------------
# Etapa 2: imagen final mínima, sin root y con healthcheck
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runtime

ARG VERSION=dev
ARG COMMIT=unknown

LABEL org.opencontainers.image.title="perfumes-api" \
      org.opencontainers.image.description="API de catálogo de perfumes (EP2 DevOps)" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.source="https://github.com/Moonlighpoio/perfumes-api" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000 \
    APP_VERSION="${VERSION}"

WORKDIR /app

# La imagen final solo necesita el runtime de Node, no npm/npx/corepack.
RUN addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /usr/local/bin/corepack

COPY --from=dependencies --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package.json ./
COPY --chown=appuser:appgroup src ./src

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
