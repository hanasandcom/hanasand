#!/usr/bin/env bash
# Run from a clean configured-Git checkout on the Linux staging host.
set -euo pipefail

privacy_stage_subnet() {
    python3 - "$@" <<'PY'
import ipaddress,json,sys
candidate=ipaddress.ip_network(sys.argv[1])
networks=json.load(open(sys.argv[2]))
routes=json.load(open(sys.argv[3]))
existing=[entry.get('Subnet','') for network in networks for entry in ((network.get('IPAM') or {}).get('Config') or [])]
existing += [route.get('dst','') for route in routes]
for value in existing:
    if not value or value=='default': continue
    try: network=ipaddress.ip_network(value,strict=False)
    except ValueError: continue
    if network.version==4 and candidate.overlaps(network): raise SystemExit('Proposed private stage subnet overlaps an existing network or host route.')
print('Private stage subnet verified unused against Docker IPAM and host routes.')
PY
}

privacy_stage_absent() {
    local kind=$1 id=$2 listing
    if [[ "$kind" == container ]]; then listing=$(docker container ls -a --quiet --no-trunc --filter "id=$id") || return 1
    else listing=$(docker network ls --quiet --no-trunc --filter "id=$id") || return 1; fi
    [[ -z "$listing" ]]
}

privacy_stage_remove() {
    local kind=$1 id=$2 owner=$3 format label
    [[ -n "$id" ]] || return 0
    [[ "$id" =~ ^[a-f0-9]{64}$ ]] || { echo 'Refusing cleanup with an invalid immutable resource ID.' >&2; return 1; }
    if [[ "$kind" == container ]]; then format='{{index .Config.Labels "hanasand.stage-run"}}'
    elif [[ "$kind" == network ]]; then format='{{index .Labels "hanasand.stage-run"}}'
    else return 1; fi
    if ! label=$(docker "$kind" inspect --format "$format" "$id" 2>/dev/null); then privacy_stage_absent "$kind" "$id"; return; fi
    [[ "$label" == "$owner" ]] || { echo 'Refusing cleanup: resource ownership label differs.' >&2; return 1; }
    if [[ "$kind" == container ]]; then docker container rm -f "$id" >/dev/null || return 1
    else docker network rm "$id" >/dev/null || return 1; fi
    privacy_stage_absent "$kind" "$id" || { echo 'Stage resource absence could not be confirmed.' >&2; return 1; }
}

privacy_stage_cleanup() {
    local status=$1
    if docker info >/dev/null 2>&1; then
        if ! privacy_stage_remove container "$runner_id" "$run_id"; then status=1; fi
        if ! privacy_stage_remove container "$database_id" "$run_id"; then status=1; fi
        if ! privacy_stage_remove network "$network_id" "$run_id"; then status=1; fi
        if ! docker info >/dev/null 2>&1; then status=1; fi
        if [[ "$status" == 0 ]]; then echo 'Owned privacy stage containers/network confirmed absent.'; fi
    else echo 'Docker unavailable; stage cleanup cannot be confirmed.' >&2; status=1; fi
    rm -rf "$temporary"
    exit "$status"
}

privacy_stage_main() {
    if [[ $# != 2 || ! "$1" =~ ^sha256:[a-f0-9]{64}$ || ! "$2" =~ ^[a-f0-9]{40}$ ]]; then
        echo 'Usage: test-organization-privacy-count-staging.sh <cached-api-image-id> <expected-runtime-git-revision>' >&2
        return 2
    fi
    local repo revision api_image image_revision db_image prefix network database runner cidr file
    repo=$(git rev-parse --show-toplevel)
    revision=$(git -C "$repo" rev-parse HEAD)
    test -z "$(git -C "$repo" status --porcelain)" || { echo 'Use a clean committed Git checkout.' >&2; return 1; }
    api_image=$1; image_revision=$2
    test "$(docker image inspect "$api_image" --format '{{.Id}}')" = "$api_image"
    test "$(docker image inspect "$api_image" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')" = "$image_revision"
    git -C "$repo" cat-file -e "$image_revision^{commit}"
    local dependencies=(api/package.json api/bun.lock api/src/constants.ts api/src/utils/db.ts api/src/utils/vms/hostConfig.ts api/src/utils/db/databaseQuery.ts api/src/utils/db/databaseTransactions.ts api/src/utils/db/runtimePools.ts api/src/utils/db/runtimePoolAccess.ts api/src/utils/db/identitySchemaQuery.ts api/src/handlers/organizationPrivacy.ts)
    git -C "$repo" diff --exit-code --quiet "$image_revision" "$revision" -- "${dependencies[@]}"
    db_image=$(docker image inspect postgres:15 --format '{{.Id}}')
    exec 9>/tmp/hanasand-privacy-count-stage.lock
    flock -n 9 || { echo 'Another privacy count stage is running.' >&2; return 1; }
    run_id=$(python3 -c 'import secrets; print(secrets.token_hex(6))')
    [[ "$run_id" =~ ^[a-f0-9]{12}$ ]]
    prefix="hanasand-privacy-count-$run_id"
    network="${prefix}-net"; database="${prefix}-db"; runner="${prefix}-runner"; cidr=10.254.250.0/28
    for name in "$database" "$runner"; do
        if docker container inspect "$name" >/dev/null 2>&1; then echo 'Refusing an existing stage container.' >&2; return 1; fi
    done
    if docker network inspect "$network" >/dev/null 2>&1; then echo 'Refusing an existing stage network.' >&2; return 1; fi
    for file in api/src/utils/organizationPrivacyRead.ts api/src/utils/organizationPrivacyLogCount.ts api/scripts/check-organization-privacy-count-postgres.ts; do
        python3 - "$repo/$file" <<'PY'
import os,stat,sys
if not os.stat(sys.argv[1]).st_mode & stat.S_IROTH: raise SystemExit('Git fixture files must be readable by the runtime image user.')
PY
    done
    temporary=$(mktemp -d /tmp/hanasand-privacy-count.XXXXXX)
    runner_id=''; database_id=''; network_id=''
    trap 'privacy_stage_cleanup "$?"' EXIT
    local networks=()
    docker network ls -q > "$temporary/network-ids"
    mapfile -t networks < "$temporary/network-ids"
    if (( ${#networks[@]} )); then docker network inspect "${networks[@]}" > "$temporary/networks.json"
    else echo '[]' > "$temporary/networks.json"; fi
    ip -j -4 route show table all > "$temporary/routes.json"
    privacy_stage_subnet "$cidr" "$temporary/networks.json" "$temporary/routes.json"
    for file in "${dependencies[@]}"; do
        printf '%s  /app/%s\n' "$(git -C "$repo" show "$revision:$file" | sha256sum | cut -d ' ' -f 1)" "${file#api/}"
    done > "$temporary/dependencies.sha256"
    chmod 644 "$temporary/dependencies.sha256"
    network_id=$(docker network create --internal --subnet "$cidr" --label hanasand.stage=privacy-count --label "hanasand.stage-run=$run_id" "$network")
    database_id=$(docker run -d --name "$database" --label hanasand.stage=privacy-count --label "hanasand.stage-run=$run_id" --network "$network_id" --network-alias privacy-count-db \
        --memory 384m --cpus 1 --read-only --tmpfs /var/lib/postgresql/data:rw,size=128m --tmpfs /var/run/postgresql:rw --tmpfs /tmp:rw \
        -e POSTGRES_USER=privacy_count -e POSTGRES_PASSWORD=synthetic-private-stage -e POSTGRES_DB=privacy_count_test "$db_image")
    for attempt in $(seq 1 30); do
        if docker exec "$database_id" pg_isready -U privacy_count -d privacy_count_test >/dev/null 2>&1; then break; fi
        if [[ "$attempt" == 30 ]]; then echo 'Synthetic stage database did not become ready.' >&2; return 1; fi
        sleep 1
    done
    runner_id=$(docker create --name "$runner" --label hanasand.stage=privacy-count --label "hanasand.stage-run=$run_id" --network "$network_id" \
        --read-only --cap-drop ALL --security-opt no-new-privileges --memory 512m --cpus 1 --tmpfs /tmp:rw,noexec,nosuid,size=64m --workdir /app --entrypoint sh \
        --mount "type=bind,src=$repo/api/src/utils/organizationPrivacyRead.ts,dst=/app/src/utils/organizationPrivacyRead.ts,readonly" \
        --mount "type=bind,src=$repo/api/src/utils/organizationPrivacyLogCount.ts,dst=/app/src/utils/organizationPrivacyLogCount.ts,readonly" \
        --mount "type=bind,src=$repo/api/scripts/check-organization-privacy-count-postgres.ts,dst=/app/scripts/check-organization-privacy-count-postgres.ts,readonly" \
        --mount "type=bind,src=$temporary/dependencies.sha256,dst=/privacy-stage-dependencies.sha256,readonly" \
        -e NODE_ENV=test -e RUN_PRIVACY_COUNT_DB_TESTS=1 -e DB=privacy_count_test -e DB_HOST=privacy-count-db -e DB_PORT=5432 \
        -e DB_USER=privacy_count -e DB_PASSWORD=synthetic-private-stage -e DB_POOL_HOST= -e HANASAND_IDENTITY_FDW_HOST= \
        -e VM_API_TOKEN=synthetic-unused -e API_HTTP_ONLY=1 -e DB_MAX_CONN=8 "$api_image" -c 'set -eu; sha256sum -c /privacy-stage-dependencies.sha256 >/dev/null; exec bun scripts/check-organization-privacy-count-postgres.ts')
    printf 'Owned stage run %s: runner=%s database=%s network=%s\n' "$run_id" "$runner_id" "$database_id" "$network_id"
    docker start -a "$runner_id"
    test "$(docker inspect "$runner_id" --format '{{.State.ExitCode}}')" = 0
    printf 'Privacy stage passed Git revision %s; immutable runtime %s (source %s).\n' "$revision" "$api_image" "$image_revision"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then privacy_stage_main "$@"; fi
