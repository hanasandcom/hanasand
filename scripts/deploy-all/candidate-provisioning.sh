export HANASAND_RELEASE_COMMIT="$release"
export BROWSER_SANDBOX_WORKER_IMAGE="hanasand_browsers:latest"
candidate_suffix=$(printf '%s-%s' "$(printf '%s' "$release" | cut -c1-12)" "$$")
candidate_offset=$(printf '%s' "$release" | cksum | awk '{ print $1 % 5000 }')
candidate_attempt=0
while test "$candidate_attempt" -lt 5000; do
    candidate_frontend_port=$((20000 + candidate_offset))
    candidate_api_port=$((25000 + candidate_offset))
    if ! ss -H -lnt "sport = :$candidate_frontend_port" | grep -q . \
        && ! ss -H -lnt "sport = :$candidate_api_port" | grep -q .; then
        break
    fi
    candidate_offset=$(((candidate_offset + 1) % 5000))
    candidate_attempt=$((candidate_attempt + 1))
done
test "$candidate_attempt" -lt 5000 || {
    echo "No unused loopback ports are available for release candidates." >&2
    exit 1
}
export HANASAND_API_CANDIDATE_CONTAINER="hanasand_api_candidate_$candidate_suffix"
export HANASAND_FRONTEND_CANDIDATE_CONTAINER="hanasand_frontend_candidate_$candidate_suffix"
export HANASAND_API_CANDIDATE_PORT=$candidate_api_port
export HANASAND_FRONTEND_CANDIDATE_PORT=$candidate_frontend_port
build_dir=$(mktemp -d "/tmp/hanasand-release-build.XXXXXX")
candidate_started=0
proxy_target=canonical
candidate_safe_to_remove=1
cleanup() {
    status=$?
    if test "$status" -ne 0 && test "$candidate_started" = 1 \
        && test "$proxy_target" != candidate && test "$candidate_safe_to_remove" = 1; then
        docker rm -f "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" "$HANASAND_API_CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
    fi
    rm -rf "$build_dir"
    return "$status"
}
trap cleanup EXIT HUP INT TERM
git archive --format=tar --output="$build_dir/source.tar" "$release"
(
    umask 022
    tar -xf "$build_dir/source.tar" -C "$build_dir"
)
rm -f "$build_dir/source.tar"
mkdir -p "$build_dir/.git"
printf 'ref: refs/heads/main\n' > "$build_dir/.git/HEAD"
if test -f "$root/.env"; then cp "$root/.env" "$build_dir/.env"; fi
if test -f "$build_dir/.env"; then
    printf 'HANASAND_DEPLOY_ENV_FILE=%s\n' "$build_dir/.env" >> "$build_dir/.env"
    if grep -q '^HANASAND_RELEASE_COMMIT=' "$build_dir/.env"; then
        sed -i "s/^HANASAND_RELEASE_COMMIT=.*/HANASAND_RELEASE_COMMIT=$release/" "$build_dir/.env"
    else
        printf 'HANASAND_RELEASE_COMMIT=%s\n' "$release" >> "$build_dir/.env"
    fi
    if grep -q '^BROWSER_SANDBOX_WORKER_IMAGE=' "$build_dir/.env"; then
        sed -i "s#^BROWSER_SANDBOX_WORKER_IMAGE=.*#BROWSER_SANDBOX_WORKER_IMAGE=$BROWSER_SANDBOX_WORKER_IMAGE#" "$build_dir/.env"
    else
        printf 'BROWSER_SANDBOX_WORKER_IMAGE=%s\n' "$BROWSER_SANDBOX_WORKER_IMAGE" >> "$build_dir/.env"
    fi
fi

compose_release() {
    if test -f "$build_dir/.env"; then
        docker compose --project-name hanasand --parallel "$deploy_parallelism" --env-file "$build_dir/.env" -f "$build_dir/docker-compose.yml" "$@"
    else
        docker compose --project-name hanasand --parallel "$deploy_parallelism" -f "$build_dir/docker-compose.yml" "$@"
    fi
}

wait_for_healthy() {
    container=$1
    service=$2
    timeout=$3
    elapsed=0
    while test "$elapsed" -lt "$timeout"; do
        state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
        health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)
        if test "$state" = running && test "$health" = healthy; then
            echo "$service is healthy."
            return 0
        fi
        if test -n "$state" && test "$state" != running; then
            echo "$service stopped during startup (state: $state)." >&2
            docker logs --tail 100 "$container" >&2 || true
            return 1
        fi
        sleep 5
        elapsed=$((elapsed + 5))
    done
    echo "$service did not become healthy within ${timeout}s." >&2
    return 1
}

require_healthy_container() {
    container=$1
    service=$2
    expected_project=$3
    expected_service=$4
    state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)
    project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$container" 2>/dev/null || true)
    actual_service=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$container" 2>/dev/null || true)
    if test "$state" != running || test "$health" != healthy || test "$project" != "$expected_project" || test "$actual_service" != "$expected_service"; then
        echo "$service must be healthy as $expected_service in independent Compose project $expected_project before this release (state=$state health=$health project=$project service=$actual_service)." >&2
        return 1
    fi
    echo "$service is healthy in $expected_project."
}

wait_for_healthy_pair() {
    first_container=$1
    first_service=$2
    first_timeout=$3
    second_container=$4
    second_service=$5
    second_timeout=$6
    wait_for_healthy "$first_container" "$first_service" "$first_timeout" &
    first_wait_pid=$!
    wait_for_healthy "$second_container" "$second_service" "$second_timeout" &
    second_wait_pid=$!
    first_status=0
    second_status=0
    wait "$first_wait_pid" || first_status=$?
    wait "$second_wait_pid" || second_status=$?
    test "$first_status" -eq 0 && test "$second_status" -eq 0
}

require_healthy_container hanasand_pgbouncer "Independent PgBouncer" hanasand-pgbouncer pgbouncer
require_healthy_container hanasand_pgbouncer_candidate "Independent PgBouncer candidate" hanasand-pgbouncer pgbouncer-candidate
require_healthy_container hanasand_onion_tor "Independent Onion proxy" hanasand-onion onion-tor
require_healthy_container hanasand_auth_primary "Identity primary" hanasand-identity identity-primary
require_healthy_container hanasand_auth_secondary "Identity secondary" hanasand-identity identity-secondary

if test "$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)" = "$release" \
    && test "$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)" = "$release"; then
    if sh "$root/scripts/verify-stack-release.sh" "$release"; then
        echo "Release $release is already deployed and verified; skipping this queued duplicate."
        exit 0
    fi
fi

# Backup work belongs to the independent database-backup service. Application
# deploys never wait for it; pg_dump uses a consistent PostgreSQL snapshot.
compose_release build frontend api
compose_live() {
    if test -f "$build_dir/.env"; then
        docker compose --project-name hanasand --parallel "$deploy_parallelism" --env-file "$build_dir/.env" -f "$build_dir/docker-compose.yml" "$@"
    else
        docker compose --project-name hanasand --parallel "$deploy_parallelism" -f "$build_dir/docker-compose.yml" "$@"
    fi
}
compose_candidates() {
    docker compose --project-name hanasand --parallel "$deploy_parallelism" --profile deployment-candidates --env-file "$build_dir/.env" \
        -f "$build_dir/docker-compose.yml" "$@"
}
identity_repo=/home/hanasand/identity
test -f "$identity_repo/compose.yaml" || {
    echo "The independent Identity checkout is missing at $identity_repo." >&2
    exit 1
}
test "$(git -C "$identity_repo" branch --show-current)" = main || {
    echo "The independent Identity checkout must be on main." >&2
    exit 1
}
git -C "$identity_repo" pull --ff-only origin main
identity_release=$(git -C "$identity_repo" rev-parse HEAD)
compose_identity() (
    export HANASAND_RELEASE_COMMIT="$identity_release"
    docker compose --project-name hanasand-identity --parallel "$deploy_parallelism" --env-file "$build_dir/.env" \
        -f "$identity_repo/compose.yaml" "$@"
)
identity_import_marker() {
    docker exec hanasand_identity_database sh -lc \
        'psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "SELECT EXISTS (SELECT 1 FROM identity_data_migrations WHERE name = '\''legacy_identity_data_v1'\'')"' \
        2>/dev/null || true
}
identity_api_boundary() {
    docker exec hanasand_database psql -X -U hanasand -d hanasand -Atc \
        "SELECT to_regclass('public.identity_data_boundary') IS NOT NULL
            AND EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.users') AND relkind = 'v')
            AND EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.organizations') AND relkind = 'v')" \
        2>/dev/null || true
}
