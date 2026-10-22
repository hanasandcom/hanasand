#!/bin/sh
# Usage: sh api/scripts/stage-identity-proxy.sh <exact-candidate-sha>
# Build a private runtime from actual remote main; bind reviewed candidate files.
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
core_source=/home/hanasand/hanasand
core_origin=$(git -C "$core_source" remote get-url origin)
case "$core_origin" in
 git@github.com:hanasandcom/hanasand.git|ssh://git@git.hanasand.com/hanasandcom/hanasand.git) ;;
 *) echo 'Unexpected core source origin; stopping.' >&2; exit 1 ;;
esac
umask 077
stage_root=$(mktemp -d /tmp/core-organization-proof-stage.XXXXXX)
stage_id=${stage_root##*.}
owner=core-organization-proof-$stage_id
label=com.hanasand.staging.owner
network=core-organization-proof-net-$stage_id
db=core-organization-proof-db-$stage_id
runner=core-organization-proof-runner-$stage_id
extract=core-organization-proof-extract-$stage_id
pin=core-organization-proof-runtime-pin-$stage_id
runtime_tag=core-organization-proof-runtime-$stage_id:stage
subnet=10.254.252.0/28
exec 3>&1
exec >"$stage_root/stage.log" 2>&1
phase() { printf '%s\n' "$*"; printf '%s\n' "$*" >&3; }
phase "stage_candidate=$expected owner=$owner private_log=$stage_root/stage.log"
for name in "$db" "$runner" "$extract" "$pin"; do
 if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage resource already exists; stopping without changes.' >&2; exit 1; fi
done
if docker network inspect "$network" >/dev/null 2>&1 || docker image inspect "$runtime_tag" >/dev/null 2>&1; then
 echo 'Stage network or image already exists; stopping without changes.' >&2; exit 1
fi
# Respect the existing Dockerfile main-branch guard. This is an actual clone of
# configured remote main, never a renamed candidate branch or production checkout.
core_revision=$(git ls-remote "$core_origin" refs/heads/main | awk '{print $1}')
test "${#core_revision}" = 40
case "$core_revision" in *[!a-f0-9]*) exit 1 ;; esac
git clone --depth 1 --single-branch --branch main "$core_origin" "$stage_root/runtime-source"
build_source=$stage_root/runtime-source
test "$(git -C "$build_source" rev-parse HEAD)" = "$core_revision"
test "$(git -C "$build_source" branch --show-current)" = main
test -z "$(git -C "$build_source" status --porcelain=v1)"
core_baseline=47263990113e31af4fa348b66be26151514c514e
for source_path in api api/package.json api/bun.lock api/Dockerfile; do
 test "$(git -C "$build_source" rev-parse "HEAD:$source_path")" = "$(git -C "$core_source" rev-parse "$core_baseline:$source_path")"
done
identity_image=$(docker inspect -f '{{.Image}}' hanasand_auth_primary)
identity_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$identity_image")
test "$identity_release" = "$identity_revision" || { echo 'Identity runtime base changed; stopping.' >&2; exit 1; }
assert_unused_subnet() {
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
}
assert_unused_subnet
phase "phase=main-provenance-verified runtime-source=$core_revision api-equivalent-to=$core_baseline identity=$identity_release"
cleanup() {
 failed=0
 for name in "$runner" "$db" "$extract" "$pin"; do
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
 if docker image inspect "$runtime_tag" >/dev/null 2>&1; then
  snapshot=$(docker image inspect -f '{{.Id}} {{index .Config.Labels "com.hanasand.staging.owner"}}' "$runtime_tag")
  resource_id=${snapshot%% *}
  actual=${snapshot#* }
  if test "$actual" = "$owner"; then docker image rm "$resource_id" >/dev/null || failed=1
  else echo 'Stage cleanup preserved an image with different ownership.' >&2; failed=1; fi
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
# Dependencies come from a new stopped immutable image container only.
docker create --name "$extract" --label "$label=$owner" --network none "$identity_image" true >/dev/null
docker cp "$extract:/app/node_modules" "$stage_root/identity/node_modules"
phase "phase=build-private-main-runtime source=$core_revision image=$runtime_tag"
# Preserve the established Dockerfile. Its non-frozen bun install is checked
# below by comparing the built lock against the exact Git lock before testing.
docker buildx build --load --target app-runtime \
 --build-arg "HANASAND_RELEASE_COMMIT=$core_revision" --label "$label=$owner" \
 --iidfile "$stage_root/runtime-image-id" --tag "$runtime_tag" --file "$build_source/api/Dockerfile" "$build_source"
core_image=$(cat "$stage_root/runtime-image-id")
test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core_image")" = "$core_revision"
docker create --name "$pin" --label "$label=$owner" --network none "$core_image" true >/dev/null
docker cp "$pin:/app/bun.lock" "$stage_root/built-bun.lock"
cmp "$build_source/api/bun.lock" "$stage_root/built-bun.lock"
phase "phase=private-runtime-ready source=$core_revision digest=$core_image lock-unchanged=true candidate=$expected"
assert_unused_subnet
docker network create --internal --label "$label=$owner" --subnet "$subnet" "$network" >/dev/null
docker run -d --name "$db" --label "$label=$owner" --network "$network" --tmpfs /var/lib/postgresql/data -e POSTGRES_DB=core_organization_proof_test -e POSTGRES_USER=synthetic -e POSTGRES_PASSWORD=synthetic-local-only postgres:15-alpine >/dev/null
for attempt in 1 2 3 4 5 6 7 8 9 10; do
 if docker exec "$db" pg_isready -U synthetic -d core_organization_proof_test >/dev/null 2>&1; then break; fi
 sleep 1
done
phase 'phase=run-exact-candidate-real-identity-proof-tests'
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
for name in "$db" "$runner" "$extract" "$pin"; do if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage cleanup verification failed' >&2; exit 1; fi; done
if docker network inspect "$network" >/dev/null 2>&1 || docker image inspect "$runtime_tag" >/dev/null 2>&1; then echo 'Stage network/image cleanup verification failed' >&2; exit 1; fi
phase 'phase=stage-passed-cleanup-absence-verified'
tail -n 6 "$stage_root/stage.log" >&3
