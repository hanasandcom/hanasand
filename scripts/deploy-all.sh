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


. "$root/scripts/deploy-all/release-preflight.sh"
. "$root/scripts/deploy-all/candidate-provisioning.sh"
. "$root/scripts/deploy-all/candidate-startup.sh"
. "$root/scripts/deploy-all/traffic-cutover-helpers.sh"
. "$root/scripts/deploy-all/release-cutover.sh"
. "$root/scripts/deploy-all/post-deploy-cleanup.sh"
