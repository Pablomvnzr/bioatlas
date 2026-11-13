FROM node:24-bookworm-slim
RUN npm install --global pnpm@11.25.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm --filter @bioatlas/api... install --frozen-lockfile
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN mkdir -p /app/apps/api/data && chown -R node:node /app/apps/api/data
USER node
WORKDIR /app/apps/api
ENV NODE_ENV=production HOST=0.0.0.0
ENV NODE_EXTRA_CA_CERTS=/app/apps/api/certs/supabase-ca.crt
EXPOSE 10000
CMD ["sh", "-c", "node scripts/check-cloud.ts && node scripts/migrate.ts && node src/server.ts"]
