FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock tsconfig.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
RUN bun install

COPY packages ./packages
COPY apps/server ./apps/server

ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "apps/server/src/index.ts"]
