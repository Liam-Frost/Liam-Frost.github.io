# One image for the whole site: Fastify serves the API, the public site (apps/web/dist), the admin app
# (apps/admin/dist) and uploaded images. See docs/local-development.md.

FROM node:26-bookworm-slim AS base
# Prisma's migration engine needs OpenSSL.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Workspace manifests only, so dependency layers are cached until a package.json or the lockfile changes.
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/

FROM manifests AS build
RUN npm ci
COPY . .
# Site and admin call the API on the same origin; the API bundle includes the generated Prisma client.
RUN npm run build

FROM manifests AS runtime
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=8787 \
  UPLOAD_DIR=/data/uploads
RUN npm ci --omit=dev --workspace apps/api && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/apps/admin/dist apps/admin/dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh

RUN chmod +x /usr/local/bin/entrypoint.sh \
  && mkdir -p /data/uploads \
  && chown -R node:node /data/uploads
USER node
VOLUME /data/uploads
EXPOSE 8787

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8787) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
