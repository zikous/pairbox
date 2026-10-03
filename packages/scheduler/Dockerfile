# The scheduler service. Built from the repo root (see compose.yaml).
FROM node:26-slim
RUN npm install -g pnpm@12.8.1
WORKDIR /app

# Dependencies first, so they are cached until a package.json changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/service/package.json packages/service/
COPY packages/scheduler/package.json packages/scheduler/
RUN CI=true pnpm install --frozen-lockfile --filter "@pairbox/scheduler..."

COPY packages/shared packages/shared
COPY packages/service packages/service
COPY packages/scheduler packages/scheduler
WORKDIR /app/packages/scheduler
CMD ["node", "--import", "tsx", "src/main.ts"]
