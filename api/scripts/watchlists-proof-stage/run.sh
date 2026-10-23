#!/bin/sh
set -eu
# Git-only private fixtures. No builds, pulls, live environment or data copies.
: "${WATCHLIST_CORE_ROOT:?}" "${WATCHLIST_CORE_SHA:?}" "${WATCHLIST_IDENTITY_ROOT:?}" "${WATCHLIST_SCRAPER_ROOT:?}"
: "${WATCHLIST_API_IMAGE:?}" "${WATCHLIST_IDENTITY_IMAGE:?}" "${WATCHLIST_BUN_IMAGE:?}" "${WATCHLIST_POSTGRES_IMAGE:?}"
: "${WATCHLIST_STAGE_PREFIX:?}" "${WATCHLIST_STAGE_SUBNET:?}" "${WATCHLIST_STAGE_MODE:?}"
identity_sha=90feba62a71844b0f3b6ac7b097ff72c400534eb
identity_runtime=5e712f2a3eb9fef204592018cf591f941c533f0d
scraper_sha=c3c01136bbfb1c6527fae1c97c8df62e2046a4f0
core_runtime=1b0a405e5136d368125c5666665a728032a73780
case "$WATCHLIST_STAGE_MODE" in core-only) ;; full) : "${WATCHLIST_WEBSITE_IMAGE:?}" ;; *) exit 1 ;; esac
stage=$WATCHLIST_CORE_ROOT/api/scripts/watchlists-proof-stage
verify_source() {
 printf '%s' "$2" | grep -Eq '^[0-9a-f]{40}$'
 test "$(git -C "$1" rev-parse HEAD)" = "$2"
 test -z "$(git -C "$1" status --porcelain=v1)"
}
verify_source "$WATCHLIST_CORE_ROOT" "$WATCHLIST_CORE_SHA"
verify_source "$WATCHLIST_IDENTITY_ROOT" "$identity_sha"
verify_source "$WATCHLIST_SCRAPER_ROOT" "$scraper_sha"
git -C "$WATCHLIST_CORE_ROOT" merge-base --is-ancestor 9b2a164bb6f7d6d784440d6cf515dbe0d5b6cb06 HEAD
for path in api/package.json api/bun.lock api/bunfig.toml api/Dockerfile; do git -C "$WATCHLIST_CORE_ROOT" diff --exit-code "$core_runtime" "$WATCHLIST_CORE_SHA" -- "$path" >/dev/null; done
for path in package.json bun.lock Dockerfile; do git -C "$WATCHLIST_IDENTITY_ROOT" diff --exit-code "$identity_runtime" "$identity_sha" -- "$path" >/dev/null; done
set -- "$WATCHLIST_API_IMAGE" "$WATCHLIST_IDENTITY_IMAGE" "$WATCHLIST_BUN_IMAGE" "$WATCHLIST_POSTGRES_IMAGE"
if test "$WATCHLIST_STAGE_MODE" = full; then set -- "$@" "$WATCHLIST_WEBSITE_IMAGE"; fi
for image do
 printf '%s' "$image" | grep -Eq '^sha256:[0-9a-f]{64}$'
 test "$(docker image inspect -f '{{.Id}}' "$image")" = "$image"
done
test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$WATCHLIST_API_IMAGE")" = "$core_runtime"
test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$WATCHLIST_IDENTITY_IMAGE")" = "$identity_runtime"
if test "$WATCHLIST_STAGE_MODE" = full; then test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$WATCHLIST_WEBSITE_IMAGE")" = "$WATCHLIST_CORE_SHA"; fi
prefix=$WATCHLIST_STAGE_PREFIX
network=$prefix-net
created=''
network_id=''
for suffix in db identity projection core website setup runner version-core version-identity version-bun version-postgres version-website; do
 if docker inspect "$prefix-$suffix" >/dev/null 2>&1; then echo 'Stage name collision; stopping.' >&2; exit 1; fi
done
if docker network inspect "$network" >/dev/null 2>&1; then echo 'Stage network collision; stopping.' >&2; exit 1; fi
python3 "$stage/test-runner.py" --preflight "$prefix" "$WATCHLIST_STAGE_SUBNET"
cleanup() {
 failed=0
 for record in $created; do
  resource_id=${record%%:*}; resource_name=${record#*:}
  if snapshot=$(docker inspect -f '{{.Id}}|{{index .Config.Labels "hanasand.stage.owner"}}' "$resource_id"); then
   if test "$snapshot" = "$resource_id|$prefix"; then docker rm -f "$resource_id" >/dev/null || failed=1
   else echo "Stage ownership changed; preserved $resource_name" >&2; failed=1; fi
  else echo "Cannot inspect stage resource $resource_name" >&2; failed=1; fi
 done
 if test -n "$network_id"; then
  if snapshot=$(docker network inspect -f '{{.Id}}|{{index .Labels "hanasand.stage.owner"}}' "$network_id"); then
   if test "$snapshot" = "$network_id|$prefix"; then docker network rm "$network_id" >/dev/null || failed=1
   else echo 'Stage network ownership changed; preserved.' >&2; failed=1; fi
  else failed=1; fi
 fi
 if inventory=$(docker ps -a --no-trunc --format '{{.ID}} {{.Names}}'); then
  for record in $created; do id=${record%%:*}; name=${record#*:}; if printf '%s\n' "$inventory" | grep -Eq "^$id | $name$"; then failed=1; fi; done
 else failed=1; fi
 if inventory=$(docker network ls --no-trunc --format '{{.ID}} {{.Name}}'); then
  if test -n "$network_id" && printf '%s\n' "$inventory" | grep -Eq "^$network_id | $network$"; then failed=1; fi
 else failed=1; fi
 return "$failed"
}
finish() { result=$?; trap - EXIT HUP INT TERM; cleanup || result=1; echo "watchlists_stage_exit=$result owner=$prefix"; exit "$result"; }
trap finish EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
create() {
 name=$1; shift
 case "$name" in *-website) memory=1024m ;; *-projection) memory=768m ;; *) memory=512m ;; esac
 last_id=$(docker create --name "$name" --label "hanasand.stage.owner=$prefix" --security-opt no-new-privileges --memory "$memory" --cpus 1 "$@")
 created="$last_id:$name $created"
 test "$(docker inspect -f '{{.Id}}|{{index .Config.Labels "hanasand.stage.owner"}}' "$last_id")" = "$last_id|$prefix"
 echo "owned_container=$last_id name=$name owner=$prefix"
}
log_owned() {
 container=$1; owned=0
 for record in $created; do if test "${record%%:*}" = "$container"; then owned=1; break; fi; done
 if test "$owned" = 1 && test "$(docker inspect -f '{{.Id}}|{{index .Config.Labels "hanasand.stage.owner"}}' "$container")" = "$container|$prefix"; then
  echo "owned_failure_logs=$container tail=80"
  docker logs --tail 80 "$container" || return 1
 else echo 'Cannot verify failed stage container ownership; logs preserved.' >&2; return 1; fi
}
start_wait() {
 if ! docker start -a "$last_id"; then log_owned "$last_id"; return 1; fi
 if test "$(docker wait "$last_id")" != 0; then log_owned "$last_id"; return 1; fi
}
probe() { create "$prefix-version-$1" --network none --read-only "$2" bun -e "console.log('Bun='+Bun.version);if(Bun.version!=='$3')process.exit(1)"; start_wait; }
probe core "$WATCHLIST_API_IMAGE" 1.3.13
probe identity "$WATCHLIST_IDENTITY_IMAGE" 1.3.13
probe bun "$WATCHLIST_BUN_IMAGE" 1.3.11
if test "$WATCHLIST_STAGE_MODE" = full; then probe website "$WATCHLIST_WEBSITE_IMAGE" 1.3.11; fi
create "$prefix-version-postgres" --network none --read-only "$WATCHLIST_POSTGRES_IMAGE" postgres --version
start_wait
docker logs "$last_id" | grep -Eq '^postgres \(PostgreSQL\) 15\.'
# Recheck after provenance/version work, immediately before the first network mutation.
python3 "$stage/test-runner.py" --preflight "$prefix" "$WATCHLIST_STAGE_SUBNET"
network_id=$(docker network create --internal --subnet "$WATCHLIST_STAGE_SUBNET" --label "hanasand.stage.owner=$prefix" "$network")
test "$(docker network inspect -f '{{.Id}}|{{index .Labels "hanasand.stage.owner"}}' "$network_id")" = "$network_id|$prefix"
create "$prefix-db" --network "$network_id" --read-only \
 --tmpfs /var/lib/postgresql/data:rw,size=384m \
 --tmpfs /var/run/postgresql:rw,size=16m \
 --tmpfs /tmp:rw,size=16m \
 -e POSTGRES_DB=ti_native_proof_test \
 -e POSTGRES_USER=synthetic \
 -e POSTGRES_PASSWORD=synthetic-local-only "$WATCHLIST_POSTGRES_IMAGE"
db_id=$last_id; docker start "$db_id" >/dev/null
ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10; do if docker exec "$db_id" pg_isready -U synthetic -d ti_native_proof_test >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
if test "$ready" != 1; then log_owned "$db_id"; exit 1; fi
create "$prefix-identity" --network "$network_id" --read-only \
 --tmpfs /tmp:rw,size=32m \
 -v "$WATCHLIST_IDENTITY_ROOT/src:/app/src:ro" \
 -v "$WATCHLIST_IDENTITY_ROOT/migrations:/app/migrations:ro" \
 -v "$WATCHLIST_SCRAPER_ROOT/scripts/native-proof-stage:/stage:ro" \
 -w /app \
 -e AUTH_SERVICE_ONLY=1 \
 -e DB_HOST="$prefix-db" \
 -e DB_POOL_HOST="$prefix-db" \
 -e DB_PORT=5432 \
 -e DB_POOL_PORT=5432 \
 -e DB=ti_native_proof_test \
 -e DB_NAME=ti_native_proof_test \
 -e DB_USER=synthetic \
 -e DB_PASSWORD=synthetic-local-only \
 -e HANASAND_IDENTITY_SERVICE_TOKEN=synthetic-internal-only "$WATCHLIST_IDENTITY_IMAGE" bun /stage/identity-server.ts
docker start "$last_id" >/dev/null
http_ready() {
 container=$1; url=$2; ready=0
 for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do if docker exec "$container" bun -e "fetch('$url',{signal:AbortSignal.timeout(1000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" >/dev/null 2>&1; then ready=1; break; fi; sleep 1; done
 if test "$ready" != 1; then log_owned "$container"; return 1; fi
}
http_ready "$last_id" http://127.0.0.1:8081/ready
# Every Core process gets only synthetic configuration. Sources and script mounts are read-only.
core_process() {
 name=$1; script=$2
 set -- "/app/scripts/watchlists-proof-stage/$script"
 if test "$script" = workflow.test.ts; then set -- test "$@" --timeout 60000; fi
 create "$name" --network "$network_id" --read-only \
 --tmpfs /tmp:rw,size=32m \
 -v "$WATCHLIST_CORE_ROOT/api/src:/app/src:ro" \
 -v "$stage:/app/scripts/watchlists-proof-stage:ro" \
 -v "$WATCHLIST_SCRAPER_ROOT/migrations:/scraper/migrations:ro" \
 -w /app \
 -e WATCHLIST_PROOF_STAGE=synthetic-only \
 -e WATCHLIST_STAGE_PREFIX="$prefix" \
 -e WATCHLIST_STAGE_MODE="$WATCHLIST_STAGE_MODE" \
 -e WATCHLIST_CORE_SHA="$WATCHLIST_CORE_SHA" \
 -e API_HTTP_ONLY=1 \
 -e DB_HOST="$prefix-db" \
 -e DB_POOL_HOST="$prefix-db" \
 -e DB_PORT=5432 \
 -e DB_POOL_PORT=5432 \
 -e DB=core_watchlist_proof_test \
 -e DB_USER=synthetic \
 -e DB_PASSWORD=synthetic-local-only \
 -e DB_MAX_CONN=8 \
 -e HANASAND_IDENTITY_FDW_HOST="$prefix-db" \
 -e IDENTITY_DB_NAME=ti_native_proof_test \
 -e HANASAND_IDENTITY_SERVICE_URL="http://$prefix-identity:8081" \
 -e HANASAND_IDENTITY_SERVICE_TOKEN=synthetic-internal-only \
 -e VM_API_TOKEN=synthetic-web-assertion \
 -e TI_SCRAPER_API_BASE="http://$prefix-projection:8097" \
 -e TI_SCRAPER_SERVICE_TOKEN=synthetic-projection-service "$WATCHLIST_API_IMAGE" bun "$@"
}
core_process "$prefix-setup" setup-databases.ts
start_wait
create "$prefix-projection" --network "$network_id" --read-only \
 --tmpfs /tmp:rw,size=32m \
 -v "$WATCHLIST_SCRAPER_ROOT/src:/scraper/src:ro" \
 -v "$WATCHLIST_SCRAPER_ROOT/package.json:/scraper/package.json:ro" \
 -v "$WATCHLIST_SCRAPER_ROOT/tsconfig.json:/scraper/tsconfig.json:ro" \
 -v "$stage:/stage:ro" \
 -w /scraper \
 -e WATCHLIST_PROOF_STAGE=synthetic-only \
 -e WATCHLIST_STAGE_PREFIX="$prefix" \
 -e PGHOST="$prefix-db" \
 -e PGDATABASE=ti_watchlist_projection_test \
 -e IDENTITY_API_BASE="http://$prefix-identity:8081/api" \
 -e HANASAND_IDENTITY_SERVICE_TOKEN=synthetic-internal-only \
 -e SCRAPER_HOST=0.0.0.0 "$WATCHLIST_BUN_IMAGE" bun /stage/projection-server.ts
docker start "$last_id" >/dev/null
# The minimal projection schema cannot claim full service/database health.
# This exact unauthenticated command rejects before body, scope or store access.
projection_ready=0
for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
 if docker exec "$last_id" bun -e "fetch('http://127.0.0.1:8097/v1/internal/organization-watchlists/reconcile',{method:'POST',signal:AbortSignal.timeout(1000)}).then(async r=>{const body=await r.json();process.exit(r.status===401&&body.error?.code==='authentication_required'?0:1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then projection_ready=1; break; fi
 sleep 1
done
if test "$projection_ready" != 1; then log_owned "$last_id"; exit 1; fi
echo 'Projection transport accepts the registered command and rejects missing service authentication; no full health claim.'
core_process "$prefix-core" core-server.ts
docker start "$last_id" >/dev/null
http_ready "$last_id" http://127.0.0.1:8082/ready
if test "$WATCHLIST_STAGE_MODE" = full; then
 create "$prefix-website" --network "$network_id" --read-only \
 --tmpfs /tmp:rw,size=32m \
 --tmpfs /var/lib/varnish:rw,exec,size=128m \
 --tmpfs /run:rw,size=16m \
 -e FRONTEND_INTERNAL_API="http://$prefix-core:8082/api" \
 -e FRONTEND_IDENTITY_API="http://$prefix-identity:8081/api" \
 -e SOCIAL_AUTH_ORIGIN=https://hanasand.com \
 -e VM_API_TOKEN=synthetic-web-assertion "$WATCHLIST_WEBSITE_IMAGE" sh /app/entrypoint.sh
 docker start "$last_id" >/dev/null
 # The minimal Core fixture does not expose aggregate /health. Check only
 # Varnish/Next transport and the real unauthenticated Watchlist route denial.
 website_ready=0
 for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if docker exec "$last_id" bun -e "fetch('http://127.0.0.1:3000/api/organizations/stage-transport-only/watchlists',{method:'GET',signal:AbortSignal.timeout(1000)}).then(async r=>{const body=await r.json();process.exit(r.status===401&&body.error?.code==='invalid_session'?0:1)}).catch(()=>process.exit(1))" >/dev/null 2>&1; then website_ready=1; break; fi
  sleep 1
 done
 if test "$website_ready" != 1; then log_owned "$last_id"; exit 1; fi
fi
printf 'core_source=%s runtime_source=%s identity_source=%s scraper_source=%s mode=%s\n' "$WATCHLIST_CORE_SHA" "$core_runtime" "$identity_sha" "$scraper_sha" "$WATCHLIST_STAGE_MODE"
printf 'images api=%s identity=%s bun=%s postgres=%s website=%s\n' "$WATCHLIST_API_IMAGE" "$WATCHLIST_IDENTITY_IMAGE" "$WATCHLIST_BUN_IMAGE" "$WATCHLIST_POSTGRES_IMAGE" "${WATCHLIST_WEBSITE_IMAGE:-none}"
core_process "$prefix-runner" workflow.test.ts
start_wait
