switch_upstreams() {
    frontend_port=$1
    api_port=$2
    next_proxy_target=$3
    last_proxy_workers=$(docker exec openresty sh -c 'ps -o pid=,args=' \
        | awk '$0 ~ /nginx: worker process$/ { print $1 }')
    backup=$(mktemp "${upstream_file}.backup.XXXXXX")
    temporary=$(mktemp "${upstream_file}.tmp.XXXXXX")
    cp "$upstream_file" "$backup"
    cat > "$temporary" <<EOF
upstream hanasand_frontend {
    server 127.0.0.1:$frontend_port max_fails=1 fail_timeout=3s;
    keepalive 32;
}

upstream hanasand_api {
    server 127.0.0.1:$api_port max_fails=1 fail_timeout=3s;
    keepalive 32;
}
EOF
    chmod --reference="$upstream_file" "$temporary"
    mv "$temporary" "$upstream_file"
    if ! docker exec openresty /usr/local/openresty/bin/openresty -t >/dev/null \
        || ! docker exec openresty /usr/local/openresty/bin/openresty -s reload; then
        mv "$backup" "$upstream_file"
        docker exec openresty /usr/local/openresty/bin/openresty -t >/dev/null 2>&1 || true
        docker exec openresty /usr/local/openresty/bin/openresty -s reload >/dev/null 2>&1 || true
        rm -f "$temporary" "$backup"
        return 1
    fi
    proxy_target=$next_proxy_target
    rm -f "$backup"
}

proxy_workers_for_pids() {
    worker_pids=$1
    state=$2
    docker exec openresty sh -c 'ps -o pid=,args=' \
        | awk -v worker_pids="$worker_pids" -v state="$state" '
            BEGIN {
                count = split(worker_pids, pids, " ")
                for (i = 1; i <= count; i++) wanted[pids[i]] = 1
            }
            $1 in wanted && $0 ~ /nginx: worker process/ {
                if (state == "shutting" && $0 !~ /nginx: worker process is shutting down/) next
                print $1
            }
        '
}

wait_for_proxy_workers_to_drain() {
    workers=$1
    test -n "$workers" || return 0
    elapsed=0
    while test "$elapsed" -lt 15; do
        pending=$(proxy_workers_for_pids "$workers" all)
        test -z "$pending" && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done

    # Reloaded workers stop taking new requests. Bound long-lived WebSockets so
    # their old upstream containers can be removed without leaving stale routes.
    shutting_down=$(proxy_workers_for_pids "$workers" shutting)
    if test "$(printf '%s\n' "$pending" | sort -u | wc -l | tr -d ' ')" \
        -ne "$(printf '%s\n' "$shutting_down" | sort -u | wc -l | tr -d ' ')"; then
        echo "OpenResty workers did not enter graceful shutdown; preserving their upstream." >&2
        return 1
    fi
    docker exec openresty sh -c "kill -TERM $shutting_down" >/dev/null 2>&1 || true

    elapsed=0
    while test "$elapsed" -lt 5; do
        pending=$(proxy_workers_for_pids "$workers" all)
        test -z "$pending" && return 0
        sleep 1
        elapsed=$((elapsed + 1))
    done
    echo "OpenResty workers still reference the previous upstream; preserving its containers." >&2
    return 1
}
