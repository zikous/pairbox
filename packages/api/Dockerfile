# The api service. Built from the repo root (see compose.yaml).
FROM node:26-slim
RUN npm install -g pnpm@12.8.1
WORKDIR /app

# Dependencies first, so they are cached until a package.json changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/service/package.json packages/service/
COPY packages/api/package.json packages/api/
RUN CI=true pnpm install --frozen-lockfile --filter "@pairbox/api..."

COPY packages/shared packages/shared
COPY packages/service packages/service
COPY packages/api packages/api
WORKDIR /app/packages/api
CMD ["node", "--import", "tsx", "src/main.ts"]
