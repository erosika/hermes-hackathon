# gateway image — Bun runtime. build context is the repo root (see fly.toml).
FROM oven/bun:1 AS base
WORKDIR /app

# workspace manifests first for cached installs
COPY package.json bun.lock tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/server/package.json ./apps/server/package.json
RUN bun install --frozen-lockfile

# source
COPY packages ./packages
COPY apps/server ./apps/server

ENV PORT=3001
EXPOSE 3001
# config comes from Fly secrets (process.env), not a .env file
CMD ["bun", "run", "apps/server/src/index.ts"]
