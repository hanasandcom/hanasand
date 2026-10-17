#!/bin/sh
set -eu

root=$(git rev-parse --show-toplevel)
cd "$root"

check_compose_healthchecks() {
    compose_file=$1
    compose_profile=${2:-}
    set -- docker compose
    if [ -n "$compose_profile" ]; then
        set -- "$@" --profile "$compose_profile"
    fi
    "$@" -f "$compose_file" config --format json | python3 -c '
import json
import sys

services = json.load(sys.stdin).get("services", {})
missing = []
for name, service in services.items():
    healthcheck = service.get("healthcheck") or {}
    test = healthcheck.get("test")
    if healthcheck.get("disable") or not isinstance(test, list) or not test or test[0] == "NONE":
        missing.append(name)

if missing:
    print("Docker healthchecks are required for every Hanasand Compose service; missing in " + sys.argv[1] + ": " + ", ".join(missing), file=sys.stderr)
    sys.exit(1)
print(f"Docker healthchecks are configured for all {len(services)} services in {sys.argv[1]}.")
    ' "$compose_file" "$compose_profile"
}

check_compose_healthchecks "$root/docker-compose.yml"
check_compose_healthchecks "$root/docker-compose.yml" deployment-candidates
