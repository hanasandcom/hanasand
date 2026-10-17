#!/bin/sh
set -eu

root=$(CDPATH= cd "$(dirname "$0")/../.." && pwd)
repo=$(mktemp -d)
trap 'rm -rf "$repo"' EXIT HUP INT TERM
git -C "$repo" init -q
git -C "$repo" config user.name "Schema Policy Test"
git -C "$repo" config user.email "schema-policy@example.invalid"

mkdir -p "$repo/db" "$repo/api/src/utils/db"
cat > "$repo/api/src/utils/db/vmLifecycleSchema.ts" <<'SOURCE'
await run(`UPDATE vms SET primary_host='inspur' WHERE EXISTS (SELECT 1 FROM vm_details)`)
SOURCE
cat > "$repo/api/src/utils/db/ensureSchema.ts" <<'SOURCE'
await query('INSERT INTO app_schema_releases (release) VALUES ($1)')
SOURCE
git -C "$repo" add .
git -C "$repo" commit -qm baseline
baseline=$(git -C "$repo" rev-parse HEAD)

cat > "$repo/api/src/utils/db/vmLifecycleSchema.ts" <<'SOURCE'
await backfillVmHostAssignments('inspur', query)
SOURCE
cat > "$repo/api/src/utils/db/ensureSchema.ts" <<'SOURCE'
await query('CREATE TABLE IF NOT EXISTS app_schema_releases (release TEXT PRIMARY KEY)')
SOURCE
cat > "$repo/api/src/utils/db/vmHostBackfill.ts" <<'SOURCE'
await query(`UPDATE vms SET primary_host='inspur' WHERE EXISTS (SELECT 1 FROM vm_details)`)
SOURCE
git -C "$repo" add .
git -C "$repo" commit -qm host-migration
host_migration=$(git -C "$repo" rev-parse HEAD)

. "$(dirname "$0")/../deploy-all/schema-change-policy.sh"
cd "$repo"
if release_has_schema_changes "$baseline" "$host_migration"; then
    echo "A host-only VM reconciliation was classified as a full schema change." >&2
    exit 1
fi

printf '\nALTER TABLE vms ADD COLUMN new_field BOOLEAN;\n' >> "$repo/api/src/utils/db/vmLifecycleSchema.ts"
git -C "$repo" add .
git -C "$repo" commit -qm actual-schema-change
schema_change=$(git -C "$repo" rev-parse HEAD)
if ! release_has_schema_changes "$host_migration" "$schema_change"; then
    echo "A real VM schema change was classified as code-only." >&2
    exit 1
fi

cat > "$repo/api/src/utils/db/ensureSchema.ts" <<'SOURCE'
await query('CREATE TABLE IF NOT EXISTS app_schema_releases (release TEXT PRIMARY KEY); ALTER TABLE vms ADD COLUMN combined_change BOOLEAN')
SOURCE
git -C "$repo" add .
git -C "$repo" commit -qm marker-and-real-schema-change
combined_schema_change=$(git -C "$repo" rev-parse HEAD)
if ! release_has_schema_changes "$host_migration" "$combined_schema_change"; then
    echo "Real DDL beside release-marker bookkeeping was classified as code-only." >&2
    exit 1
fi

. "$root/scripts/deploy-all/schema-change-policy.sh"
release=$host_migration
insert_called=0
previous_marker=t
docker() {
    case "$1 $2 $*" in
        "inspect "*) printf 'HANASAND_RELEASE_COMMIT=%s\n' "$baseline" ;;
        *"SELECT EXISTS"*) printf '%s\n' "$previous_marker" ;;
        *"INSERT INTO app_schema_releases"*) insert_called=1 ;;
        *) echo "Unexpected docker invocation in preflight fixture: $*" >&2; return 1 ;;
    esac
}
schema_changes_required=1
reuse_schema_marker_for_code_only_release
if test "$schema_changes_required" -ne 0 || test "$insert_called" -ne 1; then
    echo "A code-only release with an applied prior marker did not reuse that marker." >&2
    exit 1
fi

previous_marker=f
insert_called=0
schema_changes_required=0
reuse_schema_marker_for_code_only_release
if test "$schema_changes_required" -ne 1 || test "$insert_called" -ne 0; then
    echo "A code-only release without a prior marker did not require schema application." >&2
    exit 1
fi

echo "Schema preflight classifies VM host reconciliation and real DDL correctly."
