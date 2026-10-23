#!/bin/sh
# Usage: sh api/scripts/stage-identity-proxy.sh <exact-candidate-sha>
# Build a private synthetic proof-test image from this exact Git candidate.
set -eu
expected=${1:?Pass the exact reviewed candidate revision}
root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
test "$(git -C "$root" rev-parse HEAD)" = "$expected"
test -z "$(git -C "$root" status --porcelain=v1)"
identity_source=/home/hanasand/identity
identity_revision=5e712f2a3eb9fef204592018cf591f941c533f0d
identity_origin=$(git -C "$identity_source" remote get-url origin)
case "$identity_origin" in
 git@github.com:hanasandcom/identity.git|ssh://git@git.hanasand.com/hanasandcom/identity.git) ;;
 *) echo 'Unexpected Identity source origin; stopping.' >&2; exit 1 ;;
esac
git -C "$identity_source" cat-file -e "$identity_revision^{commit}"
umask 077
stage_root=$(mktemp -d /tmp/core-organization-proof-stage.XXXXXX)
stage_id=$(printf '%s' "$stage_root" | sha256sum | cut -c 1-12)
owner=core-organization-proof-${stage_root##*.}
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
identity_image=$(docker inspect -f '{{.Image}}' hanasand_auth_primary)
# A running container can retain an image ID removed from the local catalog.
# Resolve only its configured tag, pin the current immutable ID, and still
# require the exact reviewed Identity revision before extracting dependencies.
if ! docker image inspect "$identity_image" >/dev/null 2>&1; then
 identity_tag=$(docker inspect -f '{{.Config.Image}}' hanasand_auth_primary)
 identity_image=$(docker image inspect -f '{{.Id}}' "$identity_tag")
fi
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
current=[ipaddress.ip_network(c['Subnet'],strict=False) for n in networks for c in ((n.get('IPAM') or {}).get('Config') or []) if c.get('Subnet')]
current.extend(ipaddress.ip_network(r['dst'],strict=False) for r in routes if r.get('dst') and r['dst'] not in ('default','0.0.0.0/0'))
assert not any(proposed.overlaps(x) for x in current if x.version==proposed.version), 'Stage subnet overlaps an existing Docker network or host route'
print('phase=subnet-confirmed-unused-docker-and-host-routes')
PY
}
assert_unused_subnet
phase "phase=candidate-provenance-verified source=$expected identity=$identity_release"
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
phase "phase=build-private-proof-runtime source=$expected image=$runtime_tag"
# This dedicated test Dockerfile has no production entrypoint or main-only guard.
# Its frozen install and all source inputs come from the exact clean candidate.
docker buildx build --load \
 --build-arg "HANASAND_RELEASE_COMMIT=$expected" --label "$label=$owner" \
 --iidfile "$stage_root/runtime-image-id" --tag "$runtime_tag" --file "$root/api/Dockerfile.proof-stage" "$root"
core_image=$(cat "$stage_root/runtime-image-id")
test "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core_image")" = "$expected"
docker create --name "$pin" --label "$label=$owner" --network none "$core_image" true >/dev/null
docker cp "$pin:/app/bun.lock" "$stage_root/built-bun.lock"
cmp "$root/api/bun.lock" "$stage_root/built-bun.lock"
phase "phase=private-runtime-ready source=$expected digest=$core_image lock-unchanged=true candidate=$expected"
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
 -w /app -e RUN_CORE_ORGANIZATION_PROOF_STAGE=1 -e CORE_ORGANIZATION_PROOF_STAGE_ID="$stage_id" -e AUTH_SERVICE_ONLY=1 -e API_HTTP_ONLY=1 \
 -e DB_HOST="$db" -e DB_POOL_HOST="$db" -e DB_PORT=5432 -e DB_POOL_PORT=5432 -e DB=core_organization_proof_test -e DB_NAME=core_organization_proof_test \
 -e DB_USER=synthetic -e DB_PASSWORD=synthetic-local-only -e VM_API_TOKEN=synthetic-local-only -e HANASAND_IDENTITY_SERVICE_TOKEN=synthetic-local-only -e DB_MAX_CONN=6 \
 "$core_image" bun test /app/tests/identity-proxy-postgres.test.ts
cleanup
for name in "$db" "$runner" "$extract" "$pin"; do if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage cleanup verification failed' >&2; exit 1; fi; done
if docker network inspect "$network" >/dev/null 2>&1 || docker image inspect "$runtime_tag" >/dev/null 2>&1; then echo 'Stage network/image cleanup verification failed' >&2; exit 1; fi
phase 'phase=stage-passed-cleanup-absence-verified'
tail -n 6 "$stage_root/stage.log" >&3
