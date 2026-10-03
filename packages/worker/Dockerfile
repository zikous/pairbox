# A worker: one isolated machine for one room at a time, with every language rooms can use:
# Python, and Node for TypeScript (it runs it directly, by type stripping). Built from the repo
# root (see compose.yaml). The agent runs as root so it can clean up; room code runs as the
# unprivileged `sandbox` user.

FROM node:26-slim
# make and g++ are only used if node-pty has no prebuilt binary for this platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends procps python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.8.1 \
  && useradd --create-home --uid 1001 --shell /bin/bash sandbox \
  && mkdir /workspace && chown sandbox:sandbox /workspace
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/service/package.json packages/service/
COPY packages/worker/package.json packages/worker/
RUN CI=true pnpm install --frozen-lockfile --filter "@pairbox/worker..."

COPY packages/shared packages/shared
COPY packages/service packages/service
COPY packages/worker packages/worker
WORKDIR /app/packages/worker
CMD ["node", "--import", "tsx", "src/main.ts"]
