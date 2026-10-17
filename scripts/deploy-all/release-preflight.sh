. "$root/scripts/deploy-all/schema-change-policy.sh"

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
        ':(exclude)scripts/deploy-all.sh' ':(exclude)scripts/deploy-all/**' ':(exclude)scripts/verify-stack-release.sh'; then
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
