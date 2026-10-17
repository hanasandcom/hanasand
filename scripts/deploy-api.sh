#!/bin/sh
set -eu

require_healthy_api() {
    container=$1
    label=$2
    state=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || true)
    health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container" 2>/dev/null || true)
    if test "$state" = running && test "$health" = healthy; then return 0; fi
    echo "$label must be running and healthy (state=$state health=$health)." >&2
    return 1
}

verify_release() {
    expected=$1
    body=$(curl --fail --silent --show-error --max-time 10 http://127.0.0.1:8082/health) || return 1
    case "$body" in *'"ok":true'*"\"release\":\"$expected\""*) return 0 ;; esac
    echo "API health response did not report release $expected." >&2
    return 1
}

verify_image_revision() {
    expected=$1
    image=$(docker inspect -f '{{.Image}}' hanasand_api 2>/dev/null) || return 1
    image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image" 2>/dev/null || true)
    if test "$image_release" = "$expected"; then return 0; fi
    echo "API image revision $image_release does not match release $expected." >&2
    return 1
}

wait_for_api_release() {
    expected=$1
    timeout=$2
    elapsed=0
    while test "$elapsed" -lt "$timeout"; do
        if require_healthy_api hanasand_api "API release $expected" \
            && verify_release "$expected" && verify_image_revision "$expected"; then return 0; fi
        state=$(docker inspect -f '{{.State.Status}}' hanasand_api 2>/dev/null || true)
        if test -n "$state" && test "$state" != running; then return 1; fi
        sleep 5
        elapsed=$((elapsed + 5))
    done
    return 1
}

rollback_api() {
    reason=$1
    echo "$reason Restoring API image $previous_tag (release $rollback_release)." >&2
    if ! docker image tag "$previous_tag" hanasand_api \
        || ! HANASAND_RELEASE_COMMIT=$rollback_release docker compose up -d --no-deps --no-build api \
        || ! wait_for_api_release "$rollback_release" 600; then
        echo "API rollback could not be verified. The prior image is retained as $previous_tag; inspect the API container and logs." >&2
        echo "Database changes are not rolled back by restoring an API image; any DDL from the failed release needs a separate recovery plan." >&2
        exit 1
    fi
    echo "Restored and verified API release $rollback_release." >&2
    echo "Database changes are not rolled back by restoring an API image; any DDL from the failed release needs a separate recovery plan." >&2
    exit 1
}

root=$(git rev-parse --show-toplevel)
test "$root" = "/home/hanasand/hanasand" || {
    echo "Run this from /home/hanasand/hanasand on hanasand." >&2
    exit 1
}
cd "$root"
test "$(git symbolic-ref --quiet --short HEAD || true)" = main || {
    echo "API deployments require the main branch." >&2
    exit 1
}
test -z "$(git status --porcelain --untracked-files=normal)" || {
    echo "Refusing to deploy with local changes; fast-forward a clean main checkout first." >&2
    exit 1
}

exec 9>/tmp/hanasand-full-deploy.lock
flock 9
git fetch origin main
git merge --ff-only FETCH_HEAD
release=$(git rev-parse HEAD)
HANASAND_RELEASE_COMMIT=$release sh scripts/require-main.sh
. "$root/scripts/deploy-all/schema-change-policy.sh"

previous_image=$(docker inspect -f '{{.Image}}' hanasand_api)
previous_container_release=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' hanasand_api \
    | sed -n 's/^HANASAND_RELEASE_COMMIT=//p' | head -1)
rollback_release=${previous_container_release:-unknown}
case "$rollback_release" in *[!a-f0-9]*|'') rollback_release=unknown ;; esac
test "${#rollback_release}" -eq 40 || rollback_release=unknown
require_healthy_api hanasand_api "current API" || {
    echo "Refusing to replace an API that is not currently healthy." >&2
    exit 1
}

if test "$rollback_release" = "$release"; then
    verify_release "$release" && verify_image_revision "$release" && {
        echo "API release $release is already healthy; no build or replacement needed."
        exit 0
    }
fi

# A frontend deploy can prune an API image that is still referenced by a stopped
# or running container. Recover only an image whose OCI revision label exactly
# matches the healthy API's release, so rollback remains tied to the code we are
# replacing.
previous_image_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
    "$previous_image" 2>/dev/null || true)
if test "$previous_image_release" != "$rollback_release"; then
    recovered_image=
    for candidate in $(docker image ls -q --filter "label=org.opencontainers.image.revision=$rollback_release" 2>/dev/null | sort -u); do
        candidate_release=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' \
            "$candidate" 2>/dev/null || true)
        if test "$candidate_release" = "$rollback_release"; then
            recovered_image=$candidate
            break
        fi
    done
    if test -z "$recovered_image"; then
        echo "No available API image matches the healthy rollback release $rollback_release; refusing to deploy." >&2
        exit 1
    fi
    previous_image=$recovered_image
    echo "Recovered the rollback image for release $rollback_release from its OCI revision label."
fi

schema_changes_required=1
reuse_schema_marker_for_code_only_release
if test "$schema_changes_required" = 1; then
    echo "No prior schema marker will be reused; API startup will run its normal schema setup."
fi

if test "$rollback_release" = unknown; then
    previous_tag="hanasand_api:rollback-$(date -u +%Y%m%dT%H%M%SZ)"
else
    previous_tag="hanasand_api:rollback-$rollback_release"
fi
docker image tag "$previous_image" "$previous_tag"
echo "Retained the current API image as $previous_tag."

HANASAND_RELEASE_COMMIT=$release docker compose build api
if ! HANASAND_RELEASE_COMMIT=$release docker compose up -d --no-deps --no-build api; then
    rollback_api "Compose could not start the new API."
fi
if wait_for_api_release "$release" 600; then
    echo "API release $release is healthy and reports the target release."
    exit 0
fi
docker logs --tail 100 hanasand_api >&2 || true
rollback_api "API release $release did not become healthy and report its release."
