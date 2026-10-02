# The pool service. Built from the repo root (see compose.yaml).
FROM node:26-slim
RUN npm install -g pnpm@12.8.1
WORKDIR /app

# Dependencies first, so they are cached until a package.json changes.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/pool/package.json packages/pool/
RUN CI=true pnpm install --frozen-lockfile --filter "@pairbox/pool..."

COPY packages/shared packages/shared
COPY packages/pool packages/pool
WORKDIR /app/packages/pool
CMD ["node", "--import", "tsx", "src/main.ts"]
