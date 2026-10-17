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
