#!/bin/sh
set -eu

deploy_parallelism=${HANASAND_DEPLOY_PARALLELISM:-4}
case "$deploy_parallelism" in
    ''|*[!0-9]*|0)
        echo "HANASAND_DEPLOY_PARALLELISM must be a positive integer." >&2
        exit 1
        ;;
esac

root=$(git rev-parse --show-toplevel)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand" >&2
    exit 1
}
export HANASAND_DEPLOY_GUARD_ROOT="$root"

# Run each deployment in its own process group and serialize requests. Builds
# happen beside the live stack, so a newer main commit must wait for the
# current release to finish rather than canceling and restarting its build.
if test "${HANASAND_DEPLOY_GUARDED:-}" != 1; then
    exec env HANASAND_DEPLOY_GUARDED=1 setsid "$0" "$@"
fi

lock_file=/tmp/hanasand-full-deploy.lock
owner_file=/tmp/hanasand-full-deploy.pid
if test "${HANASAND_DEPLOY_LOCK_HELD:-}" != 1; then
    exec 9>"$lock_file"
    if ! flock -n 9; then
        echo "Another Hanasand deployment is active; waiting for it to finish." >&2
        flock 9
    fi
fi
printf '%s\n' "$$" > "$owner_file"

release_has_schema_changes() {
    previous_release=$1
    target_release=$2
    # Re-run main-database schema setup when its SQL files changed. Changes to
    # ensureSchema.ts are classified by the DDL check below, allowing Identity-
    # only setup to run before the main database release marker is checked.
    if ! git diff --quiet "$previous_release" "$target_release" -- \
        db \
        api/src/utils/db/existingSchema.ts \
        ':(glob)api/src/utils/db/*Schema.ts' \
        ':(exclude)api/src/utils/db/ensureSchema.ts'; then
        return 0
    fi
    for path in $(git diff --name-only "$previous_release" "$target_release" -- api/src); do
        test "$path" = api/src/utils/db/logSearchIndexes.ts && continue
        # The SSH usage table is provisioned directly in Identity at startup.
        test "$path" = api/src/utils/sshKeyUsage.ts && continue
        if git diff --unified=0 "$previous_release" "$target_release" -- "$path" \
            | grep -Eiq '^\+[^+].*([^[:alnum:]_])(CREATE|ALTER|DROP|TRUNCATE|REINDEX|GRANT|REVOKE)([[:space:]]|$)'; then
            return 0
        fi
    done
    return 1
}

reuse_schema_marker_for_code_only_release() {
    previous_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    case "$previous_release" in
        *[!a-f0-9]*|'') return 0 ;;
    esac
    test "${#previous_release}" -eq 40 || return 0
    test "$previous_release" != "$release" || return 0
    if release_has_schema_changes "$previous_release" "$release"; then
        return 0
    fi
    schema_changes_required=0

    previous_schema_applied=$(docker exec hanasand_database psql -U hanasand -d hanasand -Atc \
        "SELECT EXISTS (SELECT 1 FROM app_schema_releases WHERE release = '$previous_release')" 2>/dev/null || true)
    if test "$previous_schema_applied" != t; then
        schema_changes_required=1
        return 0
    fi

    docker exec hanasand_database psql -v ON_ERROR_STOP=1 -U hanasand -d hanasand \
        -c "INSERT INTO app_schema_releases (release) VALUES ('$release') ON CONFLICT DO NOTHING" >/dev/null
    echo "Reused the applied database schema marker for code-only release $release."
}

sh "$root/scripts/require-main.sh"
git fetch origin main
git merge --ff-only FETCH_HEAD
sh "$root/scripts/require-main.sh"
release=$(git rev-parse HEAD)
# The shell parsed this file before fetching. Re-exec once from the fast-forwarded
# checkout so deployment behavior matches the release being built.
if test "${HANASAND_DEPLOY_REFRESHED_RELEASE:-}" != "$release"; then
    exec env HANASAND_DEPLOY_LOCK_HELD=1 HANASAND_DEPLOY_REFRESHED_RELEASE="$release" \
        "$root/scripts/deploy-all.sh" "$@"
fi
sh "$root/scripts/require-compose-healthchecks.sh"

# Deployment-control-only commits do not change the application containers.
# Verify the currently served release and return before preparing a build tree,
# materializing runtime assets, or rebuilding every image.
running_api_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
running_frontend_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand 2>/dev/null \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
case "$running_api_release" in
    *[!a-f0-9]*|'') running_api_release= ;;
esac
if test "${#running_api_release}" -ne 40 || test "$running_frontend_release" != "$running_api_release"; then
    running_api_release=
fi
if test -n "$running_api_release" \
    && git merge-base --is-ancestor "$running_api_release" "$release" \
    && git diff --quiet "$running_api_release" "$release" -- . \
        ':(exclude)scripts/deploy-all.sh' ':(exclude)scripts/verify-stack-release.sh'; then
    if HANASAND_VERIFY_LIVE_RELEASE_ONLY=1 \
        sh "$root/scripts/verify-stack-release.sh" "$running_api_release"; then
        running_api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
        running_frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
        case "$running_api_health" in *'"ok":true'*"\"release\":\"$running_api_release\""*) ;; *)
            echo "The running API did not report its verified release; continuing with a full deployment." >&2
            running_api_release=
            ;;
        esac
        case "$running_frontend_health" in *'"ok":true'*"\"release\":\"$running_api_release\""*'"api"'*) ;; *)
            echo "The running frontend did not report its verified release; continuing with a full deployment." >&2
            running_api_release=
            ;;
        esac
        if test -n "$running_api_release"; then
            echo "Only deployment-control files changed; verified application release $running_api_release remains healthy. Skipping image builds and service recreation."
            exit 0
        fi
    else
        echo "The current application stack did not pass verification; continuing with a full deployment."
    fi
fi
schema_changes_required=1
reuse_schema_marker_for_code_only_release

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

warm_dashboard_pages() {
    port=$1
    for page_path in /scanner /vms /db/backups /automation/health /rules/tuning; do
        page_cookie='id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; dashboard_view_mode=normal'
        curl --fail --silent --show-error --max-time 15 --output /dev/null \
            -H "Cookie: $page_cookie" \
            -H 'x-hanasand-render-proof-auth: local-dashboard-render-proof' \
            "http://127.0.0.1:$port$page_path"

        response=$(curl --fail --silent --show-error --max-time 15 --output /dev/null \
            --write-out '%{http_code} %{time_starttransfer}' \
            -H "Cookie: $page_cookie" \
            -H 'x-hanasand-render-proof-auth: local-dashboard-render-proof' \
            "http://127.0.0.1:$port$page_path")
        status=${response%% *}
        elapsed=${response#* }
        if [ "$status" != "200" ] || ! awk -v elapsed="$elapsed" 'BEGIN { exit (elapsed < 0.020) ? 0 : 1 }'; then
            echo "$page_path did not reach 200 with a first byte under 20ms (status $status, ${elapsed}s)." >&2
            return 1
        fi
        printf '%s first byte %.1f ms\n' "$page_path" "$(awk -v elapsed="$elapsed" 'BEGIN { print elapsed * 1000 }')"
    done
}

warm_browser_stats() {
    port=$1
    response_file="$build_dir/browser-page.html"
    for request in 1 2; do
        response=$(curl --fail --silent --show-error --max-time 15 --output "$response_file" \
            --write-out '%{http_code} %{time_starttransfer}' "http://127.0.0.1:$port/sandbox")
        status=${response%% *}
        elapsed=${response#* }
        if [ "$status" != "200" ] \
            || ! grep -Eq '>[0-9]+<!-- --> runs today' "$response_file" \
            || ! grep -Eq '>[0-9]+<!-- --> darkweb runs today' "$response_file"; then
            echo "/sandbox did not server-render both run counts (status $status)." >&2
            return 1
        fi
        printf 'Browser stats preloaded in HTML (request %s first byte %.1f ms).\n' \
            "$request" "$(awk -v elapsed="$elapsed" 'BEGIN { print elapsed * 1000 }')"
    done
}

# Recreate root-owned dependencies only after the release candidates are healthy.
# The API candidate owns schema setup. Do not restart the shared database during
# an application release; its recovery period interrupts authenticated traffic.
services=$(compose_live config --services \
    | sed '/^api$/d; /^frontend$/d; /^postgres$/d')

# Start the API/frontend candidates against the independent candidate pool
# before touching any live dependencies. The API candidate applies additive
# schema setup but suppresses duplicate production workers.
candidate_started=1
if test "$schema_changes_required" != 1; then
    echo "Code-only release; no database schema changes, so continuing during any active backup."
fi
compose_candidates run -d --no-deps --name "$HANASAND_API_CANDIDATE_CONTAINER" \
    --publish "127.0.0.1:$HANASAND_API_CANDIDATE_PORT:8080" api-candidate >/dev/null &
api_candidate_start_pid=$!
compose_candidates run -d --no-deps --name "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" \
    --publish "127.0.0.1:$HANASAND_FRONTEND_CANDIDATE_PORT:3000" frontend-candidate >/dev/null &
frontend_candidate_start_pid=$!
candidate_start_status=0
wait "$api_candidate_start_pid" || candidate_start_status=1
wait "$frontend_candidate_start_pid" || candidate_start_status=1
if test "$candidate_start_status" -ne 0; then
    echo "Could not start both release candidates." >&2
    exit 1
fi
# Frontend health proxies the candidate API, so waiting for both at once can
# expire the shorter frontend timeout while the API is still applying schema.
wait_for_healthy "$HANASAND_API_CANDIDATE_CONTAINER" "API release candidate" 600
wait_for_healthy "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" "Frontend release candidate" 180
candidate_api_health=$(curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$HANASAND_API_CANDIDATE_PORT/health")
case "$candidate_api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "API release candidate did not report release $release." >&2
    exit 1
    ;;
esac
candidate_frontend_health=$(curl --fail --silent --show-error --max-time 10 "http://127.0.0.1:$HANASAND_FRONTEND_CANDIDATE_PORT/api/health")
case "$candidate_frontend_health" in *'"ok":true'*"\"release\":\"$release\""*"\"api\""*) ;; *)
    echo "Frontend release candidate did not report release $release and its matching API." >&2
    exit 1
    ;;
esac
warm_dashboard_pages "$HANASAND_FRONTEND_CANDIDATE_PORT"
warm_browser_stats "$HANASAND_FRONTEND_CANDIDATE_PORT"

upstream_file=/home/hanasand/openresty/nginx/conf.d/hanasand-upstreams.conf
test -w "$upstream_file" || {
    echo "Cannot update the OpenResty upstream file: $upstream_file" >&2
    exit 1
}
docker inspect openresty >/dev/null 2>&1 || {
    echo "The OpenResty container is not available for a graceful cutover." >&2
    exit 1
}
switch_upstreams() {
    frontend_port=$1
    api_port=$2
    next_proxy_target=$3
    last_proxy_workers=$(docker exec openresty sh -c 'ps -o pid=,args=' \
        | awk '$0 ~ /nginx: worker process$/ { print $1 }')
    backup=$(mktemp "${upstream_file}.backup.XXXXXX")
    temporary=$(mktemp "${upstream_file}.tmp.XXXXXX")
    cp "$upstream_file" "$backup"
    cat > "$temporary" <<EOF
upstream hanasand_frontend {
    server 127.0.0.1:$frontend_port max_fails=1 fail_timeout=3s;
    keepalive 32;
}

upstream hanasand_api {
    server 127.0.0.1:$api_port max_fails=1 fail_timeout=3s;
    keepalive 32;
}
EOF
    chmod --reference="$upstream_file" "$temporary"
    mv "$temporary" "$upstream_file"
    if ! docker exec openresty /usr/local/openresty/bin/openresty -t >/dev/null \
        || ! docker exec openresty /usr/local/openresty/bin/openresty -s reload; then
        mv "$backup" "$upstream_file"
        docker exec openresty /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
        docker exec openresty /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
        rm -f "$temporary" "$backup"
        return 1
    fi
    proxy_target=$next_proxy_target
    rm -f "$backup"
}

proxy_workers_for_pids() {
    worker_pids=$1
    state=$2
    docker exec openresty sh -c 'ps -o pid=,args=' \
        | awk -v worker_pids="$worker_pids" -v state="$state" '
            BEGIN {
                count = split(worker_pids, pids, " ")
                for (i = 1; i <= count; i++) wanted[pids[i]] = 1
            }
            $1 in wanted && $0 ~ /nginx: worker process/ {
                if (state == "shutting" && $0 !~ /nginx: worker process is shutting down/) next
                print $1
            }
        '
}

wait_for_proxy_workers_to_drain() {
    workers=$1
    test -n "$workers" || return 0
    elapsed=0
    while test "$elapsed" -lt 15; do
        pending=$(proxy_workers_for_pids "$workers" all)
        test -z "$pending" && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done

    # Reloaded workers stop taking new requests. Bound long-lived WebSockets so
    # their old upstream containers can be removed without leaving stale routes.
    shutting_down=$(proxy_workers_for_pids "$workers" shutting)
    if test "$(printf '%s\n' "$pending" | sort -u | wc -l | tr -d ' ')" \
        -ne "$(printf '%s\n' "$shutting_down" | sort -u | wc -l | tr -d ' ')"; then
        echo "OpenResty workers did not enter graceful shutdown; preserving their upstream." >&2
        return 1
    fi
    docker exec openresty sh -c "kill -TERM $shutting_down" >/dev/null 2>&1 || true

    elapsed=0
    while test "$elapsed" -lt 5; do
        pending=$(proxy_workers_for_pids "$workers" all)
        test -z "$pending" && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done
    echo "OpenResty workers still reference the previous upstream; preserving its containers." >&2
    return 1
}

if test "$(identity_api_boundary)" != t; then
    echo "First Identity PostgreSQL cutover: stopping API and Identity writers for the verified data copy."
    docker image inspect "hanasand_identity:$identity_release" >/dev/null 2>&1 || compose_identity build identity-primary
    # Prepare the new database while the current Identity pooler and workers
    # continue serving from the legacy API database.
    compose_identity up -d --no-build --wait identity-postgres

    docker rm -f "$HANASAND_FRONTEND_CANDIDATE_CONTAINER" "$HANASAND_API_CANDIDATE_CONTAINER" >/dev/null 2>&1 || true
    compose_live stop api frontend
    compose_identity stop identity-primary identity-secondary

    compose_identity --profile operations run --rm --no-deps identity-migrate bun scripts/migrate.ts --refresh
    test "$(identity_import_marker)" = t || {
        echo "Identity data import did not record its verified completion marker." >&2
        exit 1
    }

    # API startup atomically replaces the old local tables with FDW-backed
    # views. Identity workers stay stopped until those views are verified.
    compose_live up -d --no-build --no-deps api
    wait_for_healthy hanasand_api "API after Identity database cutover" 600
    test "$(identity_api_boundary)" = t || {
        echo "The API did not install the Identity database boundary." >&2
        exit 1
    }
    compose_identity up -d --no-build --wait identity-pgbouncer
    compose_identity up -d --no-build --no-deps --wait identity-secondary
    compose_identity up -d --no-build --no-deps --wait identity-primary

    compose_live up -d --no-build --no-deps deploy-path-guard
    wait_for_healthy hanasand-deploy-path-guard-1 "Deploy path guard" 30
    services=$(printf '%s\n' "$services" | sed '/^deploy-path-guard$/d')
    if test -n "$services"; then
        # shellcheck disable=SC2086
        compose_live up -d --no-build --no-deps --remove-orphans $services
    else
        echo "No dependent services need recreation."
    fi

    # The API address changed during recreation; update its host egress rules
    # before bringing the frontend back online.
    sudo -n systemctl restart hanasand-browser-egress.service
    compose_live up -d --no-build --no-deps frontend
    wait_for_healthy_pair hanasand_api "API" 600 hanasand "Frontend" 180
    canonical_frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
    case "$canonical_frontend_health" in *'"ok":true'*"\"release\":\"$release\""*'"api"'*) ;; *)
        echo "Canonical frontend did not report release $release and its matching API." >&2
        exit 1
        ;;
    esac
    canonical_api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
    case "$canonical_api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
        echo "Canonical API did not report release $release." >&2
        exit 1
        ;;
    esac
    warm_dashboard_pages 3100
    warm_browser_stats 3100
    candidate_safe_to_remove=1
    switch_upstreams 3100 8082 canonical
    wait_for_proxy_workers_to_drain "$last_proxy_workers"
else
switch_upstreams "$HANASAND_FRONTEND_CANDIDATE_PORT" "$HANASAND_API_CANDIDATE_PORT" candidate
wait_for_proxy_workers_to_drain "$last_proxy_workers"
echo "OpenResty now serves the healthy frontend and API candidates for $release."

# Recreate root-owned dependent services only after traffic is on the isolated
# candidates. PgBouncer, Onion and Identity run in separate Compose projects
# and remain available during the application handoff.
# Compose can leave the shared health-gated guard in `created` during this
# no-deps update, so start and verify it before recreating dependent services.
compose_live up -d --no-build --no-deps deploy-path-guard
wait_for_healthy hanasand-deploy-path-guard-1 "Deploy path guard" 30
services=$(printf '%s\n' "$services" | sed '/^deploy-path-guard$/d')
if test -n "$services"; then
    # shellcheck disable=SC2086
    compose_live up -d --no-build --no-deps --remove-orphans $services
else
    echo "No dependent services need recreation."
fi

compose_live up -d --no-build --no-deps api frontend
# The browser egress rules allow the current API container IP. Compose replaces
# that IP on each release, so refresh the host rules before sending traffic to it.
sudo -n systemctl restart hanasand-browser-egress.service
wait_for_healthy_pair hanasand_api "API" 600 hanasand "Frontend" 180
canonical_frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
case "$canonical_frontend_health" in *'"ok":true'*"\"release\":\"$release\""*"\"api\""*) ;; *)
    echo "Canonical frontend did not report release $release and its matching API." >&2
    exit 1
    ;;
esac
canonical_api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
case "$canonical_api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "Canonical API did not report release $release." >&2
    exit 1
    ;;
esac
warm_dashboard_pages 3100
warm_browser_stats 3100
candidate_safe_to_remove=0
switch_upstreams 3100 8082 canonical
if wait_for_proxy_workers_to_drain "$last_proxy_workers"; then
    candidate_safe_to_remove=1
    for candidate in $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
        --filter label=com.docker.compose.service=api-candidate) \
        $(docker ps -aq --filter label=com.docker.compose.project=hanasand \
        --filter label=com.docker.compose.service=frontend-candidate); do
        docker rm -f "$candidate" >/dev/null
    done
else
    # New requests use canonical now. Keep the healthy candidate stack for
    # long-lived connections still handled by the old graceful workers.
    echo "OpenResty still has connections to the release candidates; keeping them online."
fi
echo "Frontend and API health verified."
fi
# Remove containers left by the retired cross-site recovery stack. Preserve
# anonymous volumes so this cleanup cannot delete data.
for container in $(docker ps -aq --filter label=com.docker.compose.project=hanasand-recovery); do
    docker rm -f "$container"
done
for container in hanasand-tunnel hanasand-tunnel-database hanasand-tunnel-intelligence hanasand-tunnel-web hanasand-tunnel-monitor hanasand-tunnel-replication hanasand-tunnel-support hanasand-tunnel-ai hanasand-proxy-1 hanasand-proxy-2 log-catchup-pg-check; do
    if docker inspect "$container" >/dev/null 2>&1; then docker rm -f "$container"; fi
done
sh "$root/scripts/verify-stack-release.sh" "$release"
echo "Hanasand stack deployed from main at $release."
