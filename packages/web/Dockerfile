# The browser app, built and served by nginx. Built from the repo root (see compose.yaml).
FROM node:26-slim AS build
RUN npm install -g pnpm@12.8.1
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/
RUN CI=true pnpm install --frozen-lockfile --filter "@pairbox/web..."

COPY packages/shared packages/shared
COPY packages/web packages/web
RUN pnpm --filter @pairbox/web build

FROM nginx:1-alpine
COPY --from=build /app/packages/web/dist /usr/share/nginx/html
# nginx fills in ${API_PORT} from the environment when it starts.
COPY packages/web/nginx.conf.template /etc/nginx/templates/default.conf.template
