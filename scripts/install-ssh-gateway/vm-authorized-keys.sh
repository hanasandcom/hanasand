# Sourced by ../install-ssh-gateway.sh.
install_vm_authorized_keys() {
    cat >/usr/local/sbin/hanasand-vm-authorized-keys <<'SH'
#!/usr/bin/env bash
set -euo pipefail
trap '' PIPE
if [ -z "${LXC_BIN:-}" ]; then
    if [ -x /snap/lxd/current/bin/lxc ]; then
        LXC_BIN=/snap/lxd/current/bin/lxc
    else
        LXC_BIN=$(command -v lxc || true)
    fi
fi
user="${1:-}"
if [[ ! "$user" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$ ]]; then
    exit 1
fi
if [ -z "${LXC_BIN}" ] || ! "${LXC_BIN}" info "$user" >/dev/null 2>&1; then
    exit 1
fi
# Pending deletion must never wake a VM or open an SSH session.
deletion_deadline=$("${LXC_BIN}" config get "$user" user.hanasand.delete_after) || exit 1
if [ -n "$deletion_deadline" ]; then
    echo "This VM is scheduled for deletion. Restore it in the dashboard first." >&2
    exit 1
fi
wait_ready() {
    for _ in $(seq 1 90); do
        "${LXC_BIN}" exec "$1" -- true >/dev/null 2>&1 && return 0
        sleep 1
    done
    return 1
}
info=$("${LXC_BIN}" info "$user")
state=$(awk '/^Status:/ {print tolower($2); exit}' <<<"$info")
if [ "$state" != "running" ]; then
    "${LXC_BIN}" start "$user" >/dev/null 2>&1 || exit 1
fi
wait_ready "$user" || exit 1
output=$("${LXC_BIN}" exec "$user" -- sh -lc "test -r /home/$user/.ssh/authorized_keys && cat /home/$user/.ssh/authorized_keys" 2>/dev/null || true)
if [ -n "$output" ]; then
    printf '%s\n' "$output" || true
fi
exit 0
SH
    chmod 0755 /usr/local/sbin/hanasand-vm-authorized-keys

}
