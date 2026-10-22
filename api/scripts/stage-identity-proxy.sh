#!/bin/sh
# Usage: sh api/scripts/stage-identity-proxy.sh <exact-candidate-sha>
# Execute from an isolated Git checkout on the established staging host.
set -eu
expected=${1:?Pass the exact reviewed candidate revision}
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test "$(git -C "$root" rev-parse HEAD)" = "$expected"
test -z "$(git -C "$root" status --porcelain=v1)"
identity_source=/home/hanasand/identity
identity_revision=111fc5340b6e3c42cb4dc1128c5899f9e42ced52
identity_origin=$(git -C "$identity_source" remote get-url origin)
case "$identity_origin" in
 git@github.com:hanasandcom/identity.git|ssh://git@git.hanasand.com/hanasandcom/identity.git) ;;
 *) echo 'Unexpected Identity source origin; stopping.' >&2; exit 1 ;;
esac
git -C "$identity_source" cat-file -e "$identity_revision^{commit}"
umask 077
stage_root=$(mktemp -d /tmp/core-organization-proof-stage.XXXXXX)
stage_id=${stage_root##*.}
owner=core-organization-proof-$stage_id
label=com.hanasand.staging.owner
network=core-organization-proof-net-$stage_id
db=core-organization-proof-db-$stage_id
runner=core-organization-proof-runner-$stage_id
extract=core-organization-proof-extract-$stage_id
subnet=10.254.252.0/28
exec 3>&1
exec >"$stage_root/stage.log" 2>&1
printf 'stage_candidate=%s owner=%s private_log=%s/stage.log\n' "$expected" "$owner" "$stage_root" >&3
for name in "$db" "$runner" "$extract"; do
 if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage resource already exists; stopping without changes.' >&2; exit 1; fi
done
if docker network inspect "$network" >/dev/null 2>&1; then echo 'Stage network already exists; stopping without changes.' >&2; exit 1; fi
# The active core container's original image was removed from the catalog.
# Use this reviewed cached runtime only after proving its complete API tree,
# including package, lock and Dockerfile, equals the released API baseline.
core_image=sha256:4f1975f3219788a148104c738e9540a373d43df1e0a744d062e62062f8ce89b8
core_revision=d117e5a7426fe5c82d27896ded03dba27e7a83ca
core_baseline=47263990113e31af4fa348b66be26151514c514e
core_source=/home/hanasand/hanasand
for path in api api/package.json api/bun.lock api/Dockerfile; do
 test "$(git -C "$core_source" rev-parse "$core_revision:$path")" = "$(git -C "$core_source" rev-parse "$core_baseline:$path")"
done
identity_image=$(docker inspect -f '{{.Image}}' hanasand_auth_primary)
core_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core_image")
identity_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$identity_image")
test "$core_release" = "$core_revision" || { echo 'Cached core runtime revision changed; stopping.' >&2; exit 1; }
test "$identity_release" = "$identity_revision" || { echo 'Identity runtime base changed; stopping.' >&2; exit 1; }
docker network inspect $(docker network ls -q) > "$stage_root/docker-networks.json"
ip -j -4 route show table all > "$stage_root/host-routes.json"
python3 - "$subnet" "$stage_root/docker-networks.json" "$stage_root/host-routes.json" <<'PY'
import sys,json,ipaddress
proposed=ipaddress.ip_network(sys.argv[1])
networks=json.load(open(sys.argv[2]))
routes=json.load(open(sys.argv[3]))
current=[ipaddress.ip_network(c['Subnet'],strict=False) for n in networks for c in n.get('IPAM',{}).get('Config',[]) if c.get('Subnet')]
current.extend(ipaddress.ip_network(r['dst'],strict=False) for r in routes if r.get('dst') and r['dst'] not in ('default','0.0.0.0/0'))
assert not any(proposed.overlaps(x) for x in current if x.version==proposed.version), 'Stage subnet overlaps an existing Docker network or host route'
print('phase=subnet-confirmed-unused-docker-and-host-routes')
PY
printf 'phase=cached-runtime-verified core=%s digest=%s api-equivalent-to=%s identity=%s candidate=%s\n' "$core_release" "$core_image" "$core_baseline" "$identity_release" "$expected"
cleanup() {
 failed=0
 for name in "$runner" "$db" "$extract"; do
  if docker inspect "$name" >/dev/null 2>&1; then
   snapshot=$(docker inspect -f '{{.Id}} {{index .Config.Labels "com.hanasand.staging.owner"}}' "$name")
   resource_id=${snapshot%% *}
   actual=${snapshot#* }
   if test "$actual" = "$owner"; then docker rm -f "$resource_id" >/dev/null || failed=1
   else echo 'Stage cleanup preserved a container with different ownership.' >&2; failed=1; fi
  fi
 done
 if docker network inspect "$network" >/dev/null 2>&1; then
  snapshot=$(docker network inspect -f '{{.Id}} {{index .Labels "com.hanasand.staging.owner"}}' "$network")
  resource_id=${snapshot%% *}
  actual=${snapshot#* }
  if test "$actual" = "$owner"; then docker network rm "$resource_id" >/dev/null || failed=1
  else echo 'Stage cleanup preserved a network with different ownership.' >&2; failed=1; fi
 fi
 return "$failed"
}
finish() {
 result=$?
 trap - EXIT HUP INT TERM
 cleanup || result=1
 printf 'stage_exit=%s private_log=%s/stage.log\n' "$result" "$stage_root" >&3
 exit "$result"
}
trap finish EXIT HUP INT TERM
mkdir "$stage_root/identity"
git -C "$identity_source" archive "$identity_revision" package.json src migrations | tar -xf - -C "$stage_root/identity"
# This new stopped image container provides dependencies only; no production
# container filesystem, configuration, environment or volumes are copied.
docker create --name "$extract" --label "$label=$owner" --network none "$identity_image" true >/dev/null
docker cp "$extract:/app/node_modules" "$stage_root/identity/node_modules"
actual=$(docker inspect -f '{{index .Config.Labels "com.hanasand.staging.owner"}}' "$extract")
test "$actual" = "$owner"
docker rm "$extract" >/dev/null
docker network create --internal --label "$label=$owner" --subnet "$subnet" "$network" >/dev/null
docker run -d --name "$db" --label "$label=$owner" --network "$network" --tmpfs /var/lib/postgresql/data -e POSTGRES_DB=core_organization_proof_test -e POSTGRES_USER=synthetic -e POSTGRES_PASSWORD=synthetic-local-only postgres:15-alpine >/dev/null
for attempt in 1 2 3 4 5 6 7 8 9 10; do
 if docker exec "$db" pg_isready -U synthetic -d core_organization_proof_test >/dev/null 2>&1; then break; fi
 sleep 1
done
echo 'phase=run-exact-candidate-real-identity-proof-tests'
docker run --rm --name "$runner" --label "$label=$owner" --network "$network" --user "$(id -u):$(id -g)" \
 -v "$stage_root/identity:/identity:ro" \
 -v "$root/api/src/plugins/rateLimitActor.ts:/app/src/plugins/rateLimitActor.ts:ro" \
 -v "$root/api/src/routes/organizationsAndCompute.ts:/app/src/routes/organizationsAndCompute.ts:ro" \
 -v "$root/api/src/utils/identityProxy.ts:/app/src/utils/identityProxy.ts:ro" \
 -v "$root/api/src/utils/identityProxyPolicy.ts:/app/src/utils/identityProxyPolicy.ts:ro" \
 -v "$root/api/tests/identity-proxy-postgres.test.ts:/app/tests/identity-proxy-postgres.test.ts:ro" \
 -w /app -e RUN_CORE_ORGANIZATION_PROOF_STAGE=1 -e CORE_ORGANIZATION_PROOF_STAGE_ID="$stage_id" -e AUTH_SERVICE_ONLY=1 -e API_HTTP_ONLY=1 \
 -e DB_HOST="$db" -e DB_POOL_HOST="$db" -e DB_PORT=5432 -e DB_POOL_PORT=5432 -e DB=core_organization_proof_test -e DB_NAME=core_organization_proof_test \
 -e DB_USER=synthetic -e DB_PASSWORD=synthetic-local-only -e VM_API_TOKEN=synthetic-local-only -e HANASAND_IDENTITY_SERVICE_TOKEN=synthetic-local-only -e DB_MAX_CONN=6 \
 "$core_image" bun test /app/tests/identity-proxy-postgres.test.ts
cleanup
for name in "$db" "$runner" "$extract"; do if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage cleanup verification failed' >&2; exit 1; fi; done
if docker network inspect "$network" >/dev/null 2>&1; then echo 'Stage network cleanup verification failed' >&2; exit 1; fi
echo 'phase=stage-passed-cleanup-absence-verified'
tail -n 6 "$stage_root/stage.log" >&3
