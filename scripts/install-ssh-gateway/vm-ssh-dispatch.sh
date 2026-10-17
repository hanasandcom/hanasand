# Sourced by ../install-ssh-gateway.sh.
install_vm_ssh_dispatch() {
    cat >/usr/local/sbin/hanasand-vm-ssh-dispatch-root <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ -z "${LXC_BIN:-}" ]; then
    if [ -x /snap/lxd/current/bin/lxc ]; then
        LXC_BIN=/snap/lxd/current/bin/lxc
    else
        LXC_BIN=$(command -v lxc || true)
    fi
fi
vm="${HANASAND_GATEWAY_USER:-${SUDO_USER:-${USER:-}}}"
original_command="${1:-${SSH_ORIGINAL_COMMAND:-}}"
logger -t hanasand-vm-ssh-dispatch -- "user=$vm cmd=${original_command}" || true
if [[ ! "$vm" =~ ^[A-Za-z0-9][A-Za-z0-9_-]{1,63}$ ]]; then
    echo "Invalid VM name." >&2
    exit 1
fi
if [ -z "${LXC_BIN}" ] || ! "${LXC_BIN}" info "$vm" >/dev/null 2>&1; then
    echo "VM '$vm' not found." >&2
    exit 1
fi
# Pending deletion must never wake a VM or open an SSH session.
deletion_deadline=$("${LXC_BIN}" config get "$vm" user.hanasand.delete_after) || exit 1
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
info=$("${LXC_BIN}" info "$vm")
state=$(awk '/^Status:/ {print tolower($2); exit}' <<<"$info")
if [ "$state" != "running" ]; then
    echo "Starting VM '$vm'..." >&2
    "${LXC_BIN}" start "$vm" >/dev/null
fi
wait_ready "$vm" || {
    echo "VM '$vm' did not become ready." >&2
    exit 1
}
if ! "${LXC_BIN}" exec "$vm" -- id "$vm" >/dev/null 2>&1; then
    echo "User '$vm' is missing inside VM '$vm'." >&2
    exit 1
fi
if [ -n "$original_command" ]; then
    exec "${LXC_BIN}" exec "$vm" -- sudo -Hiu "$vm" -- bash -lc "$original_command"
fi
exec "${LXC_BIN}" exec "$vm" -- sudo -Hiu "$vm"
SH
    chmod 0755 /usr/local/sbin/hanasand-vm-ssh-dispatch-root

    cat >/usr/local/sbin/hanasand-vm-ssh-dispatch <<'SH'
#!/usr/bin/env bash
set -euo pipefail
if [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
    exec /usr/bin/sudo -n /usr/local/sbin/hanasand-vm-ssh-dispatch-root "$SSH_ORIGINAL_COMMAND"
fi
exec /usr/bin/sudo -n /usr/local/sbin/hanasand-vm-ssh-dispatch-root
SH
    chmod 0755 /usr/local/sbin/hanasand-vm-ssh-dispatch

}
