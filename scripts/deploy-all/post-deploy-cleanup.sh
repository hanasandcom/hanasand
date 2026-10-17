# Remove containers left by the retired cross-site recovery stack. Preserve
# anonymous volumes so this cleanup cannot delete data.
for container in $(docker ps -aq --filter label=com.docker.compose.project=hanasand-recovery); do
    docker rm -f "$container"
done
for container in hanasand-tunnel hanasand-tunnel-database hanasand-tunnel-intelligence hanasand-tunnel-web hanasand-tunnel-monitor hanasand-tunnel-replication hanasand-tunnel-support hanasand-tunnel-ai hanasand-proxy-1 hanasand-proxy-2 log-catchup-pg-check; do
    if docker inspect "$container" >/dev/null 2>&1; then docker rm -f "$container"; fi
done
sh "$root/scripts/verify-stack-release.sh" "$release"
run_support_deploy refresh
run_support_deploy activate
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:19181/ready
echo "Hanasand stack deployed from main at $release."
