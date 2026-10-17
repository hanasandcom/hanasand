#!/bin/sh
set -eu

source_root=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
base=$(mktemp -d "${TMPDIR:-/tmp}/deploy-api-check.XXXXXX")
trap 'rm -rf "$base"' EXIT
trap 'exit 1' HUP INT TERM
mkdir -p "$base/bin"
cat > "$base/bin/git" <<'MOCK_GIT'
#!/bin/sh
case "$1" in
    rev-parse) test "${2:-}" = --show-toplevel && printf '%s\n' "$CASE_ROOT" || printf '%s\n' "$TARGET_RELEASE" ;;
    symbolic-ref) echo main ;;
    status|fetch|merge|cat-file) exit 0 ;;
    diff)
        case "$*" in
            *--quiet*) test "${TEST_DDL:-0}" = 1 && exit 1 || exit 0 ;;
            *--name-only*) test "${TEST_DDL:-0}" = 1 && echo api/src/utils/db/migration.ts ;;
            *--unified=0*) echo "+ await query('CREATE TABLE example (id TEXT)')" ;;
        esac ;;
esac
MOCK_GIT
cat > "$base/bin/sh" <<'MOCK_SH'
#!/bin/sh
test "${1:-}" != scripts/require-main.sh || exit 0
exec /bin/sh "$@"
MOCK_SH
cat > "$base/bin/docker" <<'MOCK_DOCKER'
#!/bin/sh
printf '%s\n' "$*" >> "$DOCKER_LOG"
case "$*" in
    "inspect -f {{.Image}} hanasand_api") echo sha256:api ;;
    "image inspect -f {{index .Config.Labels \"org.opencontainers.image.revision\"}} sha256:api") cat "$IMAGE_RELEASE" ;;
    "inspect -f {{range .Config.Env}}{{println .}}{{end}} hanasand_api") echo "HANASAND_RELEASE_COMMIT=$(cat "$API_RELEASE")" ;;
    "inspect -f {{.State.Status}} hanasand_api") cat "$API_STATE" ;;
    "inspect -f {{if .State.Health}}{{.State.Health.Status}}{{end}} hanasand_api") cat "$API_HEALTH" ;;
    "exec hanasand_database psql"*)
        case "$*" in *SELECT\ EXISTS*) test "$TEST_MARKER" = 1 && echo t || echo f ;; *INSERT*) echo inserted >> "$DB_LOG" ;; esac ;;
    "image tag "*)
        case "$*" in *hanasand_api:rollback-*) echo retained >> "$TAG_LOG" ;; esac ;;
    "compose build api") : ;;
    "compose up "*)
        current=${HANASAND_RELEASE_COMMIT:-unknown}
        if test "$current" = "$TARGET_RELEASE" && test "$FAIL_NEW" = 1; then
            echo exited > "$API_STATE"; echo none > "$API_HEALTH"
        else
            echo running > "$API_STATE"; echo healthy > "$API_HEALTH"; echo "$current" > "$API_RELEASE"
            if test "$current" = "$TARGET_RELEASE" && test "$FAIL_LABEL" = 1; then
                echo "$OLD_RELEASE" > "$IMAGE_RELEASE"
            else
                echo "$current" > "$IMAGE_RELEASE"
            fi
        fi ;;
    "logs "*) echo startup-failed ;;
esac
MOCK_DOCKER
cat > "$base/bin/curl" <<'MOCK_CURL'
#!/bin/sh
printf '{"ok":true,"release":"%s"}\n' "$(cat "$API_RELEASE")"
MOCK_CURL
cat > "$base/bin/flock" <<'MOCK_FLOCK'
#!/bin/sh
exit 0
MOCK_FLOCK
cat > "$base/bin/sleep" <<'MOCK_SLEEP'
#!/bin/sh
exit 0
MOCK_SLEEP
chmod +x "$base/bin/"*

old_release=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
target_release=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
run_case() {
    name=$1 marker=$2 ddl=$3 fail=$4 fail_label=$5
    case_root="$base/$name"
    mkdir -p "$case_root/scripts/deploy-all"
    sed -e "s#\"/home/hanasand/hanasand\"#\"$case_root\"#" \
        -e 's/wait_for_api_release "$release" 600/wait_for_api_release "$release" 5/' \
        "$source_root/scripts/deploy-api.sh" > "$case_root/scripts/deploy-api.sh"
    cp "$source_root/scripts/deploy-all/schema-change-policy.sh" "$case_root/scripts/deploy-all/"
    cp "$source_root/scripts/require-main.sh" "$case_root/scripts/"
    api_state="$base/$name.state" api_health="$base/$name.health" api_release="$base/$name.release"
    db_log="$base/$name.db" tag_log="$base/$name.tag" docker_log="$base/$name.docker"
    image_release="$base/$name.image"
    : > "$db_log"; : > "$tag_log"; : > "$docker_log"
    echo running > "$api_state"; echo healthy > "$api_health"; echo "$old_release" > "$api_release"
    echo "$old_release" > "$image_release"
    export CASE_ROOT="$case_root" OLD_RELEASE="$old_release" TARGET_RELEASE="$target_release"
    export TEST_MARKER="$marker" TEST_DDL="$ddl" FAIL_NEW="$fail" FAIL_LABEL="$fail_label"
    export API_STATE="$api_state" API_HEALTH="$api_health" API_RELEASE="$api_release" IMAGE_RELEASE="$image_release"
    export DB_LOG="$db_log" TAG_LOG="$tag_log" DOCKER_LOG="$docker_log"
    set +e
    PATH="$base/bin:$PATH" /bin/sh "$case_root/scripts/deploy-api.sh" > "$base/$name.out" 2>&1
    status=$?
    set -e
    case "$name" in
        success) test "$status" -eq 0 && grep -q inserted "$db_log" ;;
        missing_marker|ddl)
            test "$status" -eq 0 && test ! -s "$db_log"
            ! grep -q 'Reused the applied database schema marker' "$base/$name.out" ;;
        rollback|bad_image_label)
            test "$status" -ne 0
            grep -q 'Restored and verified API release' "$base/$name.out"
            grep -q 'Database changes are not rolled back' "$base/$name.out"
            grep -q 'up -d --no-deps --no-build api' "$docker_log" ;;
    esac
}

run_case success 1 0 0 0
run_case missing_marker 0 0 0 0
run_case ddl 1 1 0 0
run_case rollback 1 0 1 0
run_case bad_image_label 1 0 0 1
echo 'API deployment mock checks passed: schema marker gates, API-only replacement, image identity, and rollback.'
