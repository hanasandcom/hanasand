#!/bin/sh
# Usage: sh api/scripts/stage-identity-proxy.sh <exact-candidate-sha>
# Runs on the established staging host from an isolated Git checkout. No live
# environment, data, volumes, ports or production networks are used.
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
exec 3>&1
exec >"$stage_root/stage.log" 2>&1
printf 'stage_candidate=%s private_log=%s/stage.log\n' "$expected" "$stage_root" >&3
mkdir "$stage_root/identity"
git -C "$identity_source" archive "$identity_revision" package.json src migrations | tar -xf - -C "$stage_root/identity"
network=core-organization-proof-stage
db=core-organization-proof-db
runner=core-organization-proof-runner
extract=core-organization-proof-image-extract
subnet=10.254.252.0/28
for name in "$db" "$runner" "$extract"; do
 if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage resource already exists; stopping without changes.' >&2; exit 1; fi
done
if docker network inspect "$network" >/dev/null 2>&1; then echo 'Stage network already exists; stopping without changes.' >&2; exit 1; fi
core_image=$(docker inspect -f '{{.Image}}' hanasand_api)
identity_image=$(docker inspect -f '{{.Image}}' hanasand_auth_primary)
core_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$core_image")
identity_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$identity_image")
test "$core_release" = 47263990113e31af4fa348b66be26151514c514e || { echo 'Core runtime base changed; stopping.' >&2; exit 1; }
test "$identity_release" = 111fc5340b6e3c42cb4dc1128c5899f9e42ced52 || { echo 'Identity runtime base changed; stopping.' >&2; exit 1; }
docker network inspect $(docker network ls -q) | python3 -c 'import sys,json,ipaddress; proposed=ipaddress.ip_network(sys.argv[1]); current=[ipaddress.ip_network(c["Subnet"],strict=False) for n in json.load(sys.stdin) for c in n.get("IPAM",{}).get("Config",[]) if c.get("Subnet")]; assert not any(proposed.overlaps(x) for x in current if x.version==proposed.version), "Stage subnet overlaps existing network"; print("phase=subnet-confirmed-unused")' "$subnet"
printf 'phase=runtime-verified core=%s identity=%s candidate=%s\n' "$core_release" "$identity_release" "$expected"
created=''
network_created=0
cleanup() {
 for name in $created; do docker rm -f "$name" >/dev/null 2>&1 || true; done
 if test "$network_created" = 1; then docker network rm "$network" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT HUP INT TERM
# Extract dependencies only from a new stopped immutable image container. Never
# inspect or copy production configuration, environment files or runtime volumes.
created="$extract $created"
docker create --name "$extract" --network none "$identity_image" true >/dev/null
docker cp "$extract:/app/node_modules" "$stage_root/identity/node_modules"
docker rm "$extract" >/dev/null
created=''
docker network create --internal --subnet "$subnet" "$network" >/dev/null
network_created=1
created="$db $created"
docker run -d --name "$db" --network "$network" --tmpfs /var/lib/postgresql/data -e POSTGRES_DB=core_organization_proof_test -e POSTGRES_USER=synthetic -e POSTGRES_PASSWORD=synthetic-local-only postgres:15-alpine >/dev/null
for attempt in 1 2 3 4 5 6 7 8 9 10; do
 if docker exec "$db" pg_isready -U synthetic -d core_organization_proof_test >/dev/null 2>&1; then break; fi
 sleep 1
done
created="$runner $created"
echo 'phase=run-exact-candidate-real-identity-proof-tests'
docker run --rm --name "$runner" --network "$network" --user "$(id -u):$(id -g)" \
 -v "$stage_root/identity:/identity:ro" \
 -v "$root/api/src/plugins/rateLimitActor.ts:/app/src/plugins/rateLimitActor.ts:ro" \
 -v "$root/api/src/routes/organizationsAndCompute.ts:/app/src/routes/organizationsAndCompute.ts:ro" \
 -v "$root/api/src/utils/identityProxy.ts:/app/src/utils/identityProxy.ts:ro" \
 -v "$root/api/src/utils/identityProxyPolicy.ts:/app/src/utils/identityProxyPolicy.ts:ro" \
 -v "$root/api/tests/identity-proxy-postgres.test.ts:/app/tests/identity-proxy-postgres.test.ts:ro" \
 -w /app -e RUN_CORE_ORGANIZATION_PROOF_STAGE=1 -e AUTH_SERVICE_ONLY=1 -e API_HTTP_ONLY=1 \
 -e DB_HOST="$db" -e DB_POOL_HOST="$db" -e DB_PORT=5432 -e DB_POOL_PORT=5432 -e DB=core_organization_proof_test -e DB_NAME=core_organization_proof_test \
 -e DB_USER=synthetic -e DB_PASSWORD=synthetic-local-only -e VM_API_TOKEN=synthetic-local-only -e HANASAND_IDENTITY_SERVICE_TOKEN=synthetic-local-only -e DB_MAX_CONN=6 \
 "$core_image" bun test /app/tests/identity-proxy-postgres.test.ts
cleanup
created=''
network_created=0
for name in "$db" "$runner" "$extract"; do if docker inspect "$name" >/dev/null 2>&1; then echo 'Stage cleanup verification failed' >&2; exit 1; fi; done
if docker network inspect "$network" >/dev/null 2>&1; then echo 'Stage network cleanup verification failed' >&2; exit 1; fi
echo 'phase=stage-passed-cleanup-absence-verified'
tail -n 6 "$stage_root/stage.log" >&3
