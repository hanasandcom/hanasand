FROM grafana/k6:latest AS k6builder

FROM oven/bun:1.3.13-alpine AS deps

ARG HANASAND_STAGE_BUILD=0
COPY .git/HEAD /tmp/hanasand-source-head
RUN if [ "$HANASAND_STAGE_BUILD" = "1" ]; then test -s /tmp/hanasand-source-head; else test "$(cat /tmp/hanasand-source-head)" = "ref: refs/heads/main" || { echo "Production image builds are allowed only from the main branch." >&2; exit 1; }; fi

WORKDIR /app

COPY api/package.json api/bun.lock* api/bunfig.toml ./
RUN bun install

FROM oven/bun:1.3.13-alpine AS app-runtime-base

ARG HANASAND_RELEASE_COMMIT=unknown
LABEL org.opencontainers.image.revision=$HANASAND_RELEASE_COMMIT
RUN apk add --no-cache varnish git openssh-client docker-cli curl tar postgresql-client

COPY --from=k6builder /usr/bin/k6 /usr/bin/k6

WORKDIR /app
ENV NODE_ENV=production

COPY api/default.vcl /etc/varnish/default.vcl
COPY --from=deps /app/node_modules /app/node_modules
COPY api/ .

RUN chmod +x /app/entrypoint.sh

FROM app-runtime-base AS app-review
# The full API test/lint gate is an explicit review target so production image
# builds do not block on it or inherit its build-only credentials.
RUN apk add --no-cache bash
RUN ln -s /app /api
COPY docker-compose.yml docker-compose.api.yml /
RUN --mount=from=database_schema,target=/db NODE_ENV=test DB_PASSWORD=build-test DB_HOST=localhost DB_POOL_HOST=localhost DB_POOL_PORT=18505 DB_MAX_CONN=1000 VM_API_TOKEN=build-test bun run test
RUN bun run lint

FROM app-runtime-base AS app-runtime

EXPOSE 8080

FROM app-runtime

CMD chmod +x /app/entrypoint.sh; /app/entrypoint.sh
