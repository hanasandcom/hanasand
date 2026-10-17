warm_dashboard_pages() {
    port=$1
    for page_path in /scanner /vms /db/backups /automation/health /rules/tuning; do
        page_cookie='id=dashboard-render-proof-user; access_token=local-dashboard-render-proof-token; dashboard_view_mode=normal'
        response=$(curl --fail --silent --show-error --max-time 15 --output /dev/null \
            --write-out '%{http_code} %{time_starttransfer}' \
            -H "Cookie: $page_cookie" \
            -H 'x-hanasand-render-proof-auth: local-dashboard-render-proof' \
            "http://127.0.0.1:$port$page_path")
        status=${response%% *}
        elapsed=${response#* }
        if [ "$status" != "200" ]; then
            echo "$page_path did not reach 200 (status $status)." >&2
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

# Freeze the independent Support API and seed its database before routing the
# release candidates. The final refresh below runs after traffic leaves the
# old in-process Support implementation.
support_repo=/home/hanasand/support
test -f "$support_repo/compose.yaml" || {
    echo "The independent Support checkout is missing at $support_repo." >&2
    exit 1
}
test "$(git -C "$support_repo" branch --show-current)" = main || {
    echo "The independent Support checkout must be on main." >&2
    exit 1
}
run_support_deploy() {
    (cd "$support_repo" && sh scripts/deploy.sh "$@")
}
git -C "$support_repo" pull --ff-only origin main
run_support_deploy prepare

upstream_file=/home/hanasand/openresty/nginx/conf.d/hanasand-upstreams.conf
test -w "$upstream_file" || {
    echo "Cannot update the OpenResty upstream file: $upstream_file" >&2
    exit 1
}
docker inspect openresty >/dev/null 2>&1 || {
    echo "The OpenResty container is not available for a graceful cutover." >&2
    exit 1
}
