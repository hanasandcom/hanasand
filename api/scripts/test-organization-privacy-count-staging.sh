#!/usr/bin/env bash
# Run from a clean Git checkout fetched through a configured remote on the Linux
# staging host. Source is never uploaded separately. No production env/data used.
set -euo pipefail
if [[ $# != 1 || ! "$1" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    echo 'Usage: test-organization-privacy-count-staging.sh <cached-immutable-api-image-id>' >&2
    exit 2
fi
repo=$(git rev-parse --show-toplevel)
revision=$(git -C "$repo" rev-parse HEAD)
test -z "$(git -C "$repo" status --porcelain)" || { echo 'Use a clean committed Git checkout.' >&2; exit 1; }
api_image=$1
test "$(docker image inspect "$api_image" --format '{{.Id}}')" = "$api_image"
db_image=$(docker image inspect postgres:15 --format '{{.Id}}')
exec 9>/tmp/hanasand-privacy-count-stage.lock
flock -n 9 || { echo 'Another privacy count stage is running.' >&2; exit 1; }
prefix="hanasand-privacy-count-${revision:0:8}-$$"
network="${prefix}-net"
database="${prefix}-db"
runner="${prefix}-runner"
cidr=10.254.250.0/28
for name in "$database" "$runner"; do
    if docker container inspect "$name" >/dev/null 2>&1; then echo 'Refusing an existing stage container.' >&2; exit 1; fi
done
if docker network inspect "$network" >/dev/null 2>&1; then echo 'Refusing an existing stage network.' >&2; exit 1; fi
temporary=$(mktemp -d /tmp/hanasand-privacy-count.XXXXXX)
created=false
cleanup() {
    status=$?
    if [[ "$created" == true ]]; then
        docker rm -f "$runner" "$database" >/dev/null 2>&1 || true
        docker network rm "$network" >/dev/null 2>&1 || true
        docker info >/dev/null
        for name in "$runner" "$database"; do
            if docker container inspect "$name" >/dev/null 2>&1; then echo 'Stage cleanup left a container.' >&2; status=1; fi
        done
        if docker network inspect "$network" >/dev/null 2>&1; then echo 'Stage cleanup left a network.' >&2; status=1; fi
        echo 'Privacy stage containers/network confirmed absent.'
    fi
    rm -rf "$temporary"
    exit "$status"
}
trap cleanup EXIT
mapfile -t networks < <(docker network ls -q)
docker network inspect "${networks[@]}" > "$temporary/networks.json"
ip -j -4 route show table all > "$temporary/routes.json"
python3 - "$cidr" "$temporary/networks.json" "$temporary/routes.json" <<'PY'
import ipaddress,json,sys
candidate=ipaddress.ip_network(sys.argv[1])
networks=json.load(open(sys.argv[2]))
routes=json.load(open(sys.argv[3]))
existing=[entry.get('Subnet','') for network in networks for entry in network.get('IPAM',{}).get('Config',[]) or []]
existing += [route.get('dst','') for route in routes]
for value in existing:
    if not value or value=='default': continue
    try: network=ipaddress.ip_network(value,strict=False)
    except ValueError: continue
    if network.version==4 and candidate.overlaps(network): raise SystemExit('Proposed private stage subnet overlaps an existing network or host route.')
print('Private stage subnet verified unused against Docker IPAM and host routes.')
PY
docker network create --internal --subnet "$cidr" --label hanasand.stage=privacy-count "$network" >/dev/null
created=true
docker run -d --name "$database" --network "$network" --network-alias privacy-count-db \
    --memory 384m --cpus 1 --read-only --tmpfs /var/lib/postgresql/data:rw,size=128m \
    --tmpfs /var/run/postgresql:rw --tmpfs /tmp:rw \
    -e POSTGRES_USER=privacy_count -e POSTGRES_PASSWORD=synthetic-private-stage -e POSTGRES_DB=privacy_count_test \
    "$db_image" >/dev/null
for attempt in $(seq 1 30); do
    if docker exec "$database" pg_isready -U privacy_count -d privacy_count_test >/dev/null 2>&1; then break; fi
    if [[ "$attempt" == 30 ]]; then echo 'Synthetic stage database did not become ready.' >&2; exit 1; fi
    sleep 1
done
docker run --name "$runner" --network "$network" --read-only --cap-drop ALL --security-opt no-new-privileges \
    --memory 512m --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=64m --workdir /app --entrypoint bun \
    --mount "type=bind,src=$repo/api/src/utils/organizationPrivacyRead.ts,dst=/app/src/utils/organizationPrivacyRead.ts,readonly" \
    --mount "type=bind,src=$repo/api/src/utils/organizationPrivacyLogCount.ts,dst=/app/src/utils/organizationPrivacyLogCount.ts,readonly" \
    --mount "type=bind,src=$repo/api/scripts/check-organization-privacy-count-postgres.ts,dst=/app/scripts/check-organization-privacy-count-postgres.ts,readonly" \
    -e NODE_ENV=test -e RUN_PRIVACY_COUNT_DB_TESTS=1 -e DB=privacy_count_test -e DB_HOST=privacy-count-db \
    -e DB_PORT=5432 -e DB_USER=privacy_count -e DB_PASSWORD=synthetic-private-stage -e DB_POOL_HOST= \
    -e HANASAND_IDENTITY_FDW_HOST= -e VM_API_TOKEN=synthetic-unused -e API_HTTP_ONLY=1 -e DB_MAX_CONN=8 \
    "$api_image" scripts/check-organization-privacy-count-postgres.ts
printf 'Privacy count staging passed exact Git revision %s using immutable runtime %s.\n' "$revision" "$api_image"
