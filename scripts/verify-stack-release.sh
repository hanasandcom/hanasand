#!/bin/sh
set -eu

release=${1:-$(git rev-parse HEAD)}
current_branch=$(git branch --show-current)
current_release=$(git rev-parse HEAD)
test "$current_branch" = main && git merge-base --is-ancestor "$release" "$current_release" || {
    echo "Release must be checked out on main or be an ancestor of its current commit: $release" >&2
    exit 1
}

verify_image_revision() {
    container=$1
    image=$2
    image_release=$3
    expected_release=$4
    allow_missing_image=${5:-0}
    if ! docker image inspect "$image" >/dev/null 2>&1; then
        if test "${HANASAND_VERIFY_LIVE_RELEASE_ONLY:-0}" = 1 || test "$allow_missing_image" = 1; then
            echo "$container has no retained image metadata; checking its live release marker and health instead." >&2
            return 0
        fi
        echo "$container image is not available to verify (expected revision $expected_release)." >&2
        return 1
    fi
    test "$image_release" = "$expected_release" || {
        echo "$container image has revision $image_release, expected $expected_release" >&2
        return 1
    }
}

containers='hanasand hanasand_api'
for container in $containers; do
    test "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" = true || {
        echo "Required Hanasand container is not running: $container" >&2
        exit 1
    }
    test "$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || true)" = healthy || {
        echo "Required Hanasand container is not healthy: $container" >&2
        exit 1
    }
    env_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
        | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
    test "$env_release" = "$release" || {
        echo "$container has release $env_release, expected $release" >&2
        exit 1
    }
    image=$(docker inspect -f '{{.Image}}' "$container")
    image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
    verify_image_revision "$container" "$image" "$image_release" "$release"
done

systemctl is-active --quiet hanasand-ovh-host-metrics.timer || {
    echo "The OVH host metrics refresh timer is not active." >&2
    exit 1
}
if ! curl --fail --silent --show-error --max-time 10 http://127.0.0.1:19911/status \
    | grep -Eq '"site"[[:space:]]*:[[:space:]]*"ovhcloud"'; then
    echo "The OVH host metrics tunnel does not return OVH status." >&2
    exit 1
fi
metrics_age=$(($(date +%s) - $(stat -c %Y /var/lib/hanasand/metrics/ovhcloud.json)))
if test "$metrics_age" -lt 0 || test "$metrics_age" -gt 90; then
    echo "OVH host telemetry is not fresh (age: ${metrics_age}s)." >&2
    exit 1
fi

verify_independent_container() {
    container=$1
    expected_project=$2
    expected_service=$3
    state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)
    project=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$container" 2>/dev/null || true)
    service=$(docker inspect -f '{{index .Config.Labels "com.docker.compose.service"}}' "$container" 2>/dev/null || true)
    if test "$state" != running || test "$health" != healthy || test "$project" != "$expected_project" || test "$service" != "$expected_service"; then
        echo "$container must be healthy as $expected_service in independent Compose project $expected_project (state=$state health=$health project=$project service=$service)." >&2
        return 1
    fi
}

verify_independent_container hanasand_pgbouncer hanasand-pgbouncer pgbouncer
verify_independent_container hanasand_pgbouncer_candidate hanasand-pgbouncer pgbouncer-candidate
verify_independent_container hanasand_onion_tor hanasand-onion onion-tor
verify_independent_container hanasand_auth_primary hanasand-identity identity-primary
verify_independent_container hanasand_auth_secondary hanasand-identity identity-secondary
verify_independent_container hanasand_browsers hanasand-browsers browsers
verify_independent_container hanasand_browser_turn hanasand-browser-turn browser-turn

for container in $(docker ps -aq --filter label=com.docker.compose.project=hanasand-recovery) \
    hanasand-tunnel hanasand-tunnel-database hanasand-tunnel-intelligence hanasand-tunnel-web \
    hanasand-tunnel-monitor hanasand-tunnel-replication hanasand-tunnel-support hanasand-tunnel-ai \
    hanasand-proxy-1 hanasand-proxy-2 log-catchup-pg-check; do
    if docker inspect "$container" >/dev/null 2>&1; then
        echo "Retired recovery container still exists: $container" >&2
        exit 1
    fi
done

# Browser warm workers are created directly by the API, so site releases keep
# their containers and image versions. Confirm every slot remains healthy.
elapsed=0
while test "$elapsed" -lt 240; do
    browser_pool_current=1
    for slot in 0 1 2 3 4; do
        container="hanasand_browser_warm_$slot"
        if ! docker inspect "$container" >/dev/null 2>&1; then
            browser_pool_current=0
            continue
        fi
        running=$(docker inspect -f '{{.State.Running}}' "$container")
        health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container")
        image=$(docker inspect -f '{{.Image}}' "$container")
        image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
        case "$image_release" in *[!a-f0-9]*|'') browser_pool_current=0 ;; esac
        if test "$running" != true || test "$health" != healthy || test "${#image_release}" -ne 40; then
            browser_pool_current=0
        fi
    done
    test "$browser_pool_current" = 1 && break
    sleep 5
    elapsed=$((elapsed + 5))
done
test "$browser_pool_current" = 1 || {
    echo "Browser warm pool did not reach five healthy workers within 240 seconds." >&2
    exit 1
}

# Container health does not prove the API can claim or connect to a warm worker.
# Probe the authenticated worker status from the API's own network namespace.
for slot in 0 1 2 3 4; do
    container="hanasand_browser_warm_$slot"
    worker_ip=$(docker inspect -f "{{.NetworkSettings.Networks.hanasand_browsernet.IPAddress}}" "$container")
    worker_token=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$container" \
        | sed -n 's/^BROWSER_SANDBOX_POOL_TOKEN=//p' | head -1)
    if test -z "$worker_ip" || test -z "$worker_token" \
        || ! printf '%s' "$worker_token" | docker exec -i \
            -e "HANASAND_BROWSER_WORKER_PROBE_IP=$worker_ip" hanasand_api bun -e '
                const token = await new Response(Bun.stdin.stream()).text()
                const ip = process.env.HANASAND_BROWSER_WORKER_PROBE_IP
                const response = await fetch(`http://${ip}:8090/internal/browser-warm`, {
                    headers: { "x-browser-pool-token": token },
                    signal: AbortSignal.timeout(1500),
                })
                const status = await response.json()
                const health = await fetch(`http://${ip}:8080/health`, { signal: AbortSignal.timeout(1000) })
                if (!response.ok || status.state !== "ready" || !health.ok) process.exit(1)
            ' >/dev/null 2>&1; then
        echo "API cannot reach ready browser worker slot $slot." >&2
        exit 1
    fi
done

api_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health)
case "$api_health" in *'"ok":true'*"\"release\":\"$release\""*) ;; *)
    echo "API health endpoint did not report release $release." >&2
    exit 1
    ;;
esac
frontend_health=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3100/api/health)
case "$frontend_health" in *'"ok":true'*"\"release\":\"$release\""*"\"api\""*) ;; *)
    echo "Frontend health endpoint did not report release $release and API health." >&2
    exit 1
    ;;
esac
recovery_route_status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 10 http://127.0.0.1:3100/api/recovery)
test "$recovery_route_status" = 404 || {
    echo "Retired /api/recovery route returned HTTP $recovery_route_status instead of 404." >&2
    exit 1
}

echo "Application, browser, and independent service health checks passed for release $release."
