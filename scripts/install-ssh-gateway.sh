#!/usr/bin/env bash
set -euo pipefail

HOST_USER="${HOST_USER:-hanasand}"
HOST_SOURCE_USER="${HOST_SOURCE_USER:-ubuntu}"
VM_GROUP="${VM_GROUP:-hanasand-vm}"
FORGEJO_CONTAINER="${FORGEJO_CONTAINER:-git_ui}"
FORGEJO_AUTHORIZED_KEYS="${FORGEJO_AUTHORIZED_KEYS:-/var/lib/docker/volumes/git_git_data/_data/git/.ssh/authorized_keys}"
FORGEJO_APP_INI="${FORGEJO_APP_INI:-/data/gitea/conf/app.ini}"
PRIMARY_PORTS="${PRIMARY_PORTS:-22 222}"
EMERGENCY_PORTS="${EMERGENCY_PORTS:-2223}"
TEST_PORT="${TEST_PORT:-}"
GATEWAY_ADDRESS_FAMILY="${GATEWAY_ADDRESS_FAMILY:-inet}"
if [ -z "${LXC_BIN:-}" ]; then
    if [ -x /snap/lxd/current/bin/lxc ]; then
        LXC_BIN=/snap/lxd/current/bin/lxc
    else
        LXC_BIN=$(command -v lxc || true)
    fi
fi

require_root() {
    if [ "${EUID}" -ne 0 ]; then
        echo "Run as root." >&2
        exit 1
    fi
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/install-ssh-gateway/forgejo-helper.sh"
source "${SCRIPT_DIR}/install-ssh-gateway/forgejo-authorized-keys.sh"
source "${SCRIPT_DIR}/install-ssh-gateway/vm-authorized-keys.sh"
source "${SCRIPT_DIR}/install-ssh-gateway/vm-ssh-dispatch.sh"
source "${SCRIPT_DIR}/install-ssh-gateway/sync-ssh-users.sh"

install_host_user() {
    if ! id "${HOST_USER}" >/dev/null 2>&1; then
        useradd -m -s /bin/bash "${HOST_USER}"
    fi
    install -d -m 700 -o "${HOST_USER}" -g "${HOST_USER}" "/home/${HOST_USER}/.ssh"
    if [ "/home/${HOST_SOURCE_USER}/.ssh/authorized_keys" != "/home/${HOST_USER}/.ssh/authorized_keys" ]; then
        cp "/home/${HOST_SOURCE_USER}/.ssh/authorized_keys" "/home/${HOST_USER}/.ssh/authorized_keys"
    fi
    chown "${HOST_USER}:${HOST_USER}" "/home/${HOST_USER}/.ssh/authorized_keys"
    chmod 600 "/home/${HOST_USER}/.ssh/authorized_keys"
}

install_sync_timer() {
    cat >/etc/systemd/system/hanasand-sync-ssh-users.service <<'UNIT'
[Unit]
Description=Synchronize Hanasand LXD instance SSH gateway users

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/hanasand-sync-ssh-users
UNIT

    cat >/etc/systemd/system/hanasand-sync-ssh-users.timer <<'UNIT'
[Unit]
Description=Periodically synchronize Hanasand LXD instance SSH gateway users

[Timer]
OnBootSec=2min
OnUnitActiveSec=30min
AccuracySec=2min
Unit=hanasand-sync-ssh-users.service

[Install]
WantedBy=timers.target
UNIT

    systemctl daemon-reload
    systemctl enable --now hanasand-sync-ssh-users.timer
}

write_sshd_configs() {
    local ports_content=""
    if [ -n "${TEST_PORT}" ]; then
        ports_content="Port ${TEST_PORT}"
    else
        for port in ${PRIMARY_PORTS}; do
            ports_content="${ports_content}Port ${port}"$'\n'
        done
    fi

    cat >/etc/ssh/sshd_config_hanasand_gateway <<CONF
${ports_content}
AddressFamily ${GATEWAY_ADDRESS_FAMILY}
HostKey /etc/ssh/ssh_host_ed25519_key
UseDNS no
GSSAPIAuthentication no
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
ChallengeResponseAuthentication no
UsePAM yes
PermitRootLogin no
X11Forwarding no
PrintMotd yes
AcceptEnv LANG LC_*
AuthorizedKeysFile .ssh/authorized_keys
Subsystem sftp /usr/lib/openssh/sftp-server

Match User git
    AuthorizedKeysCommand /usr/local/sbin/forgejo-authorized-keys %u
    AuthorizedKeysCommandUser root
    PasswordAuthentication no
    KbdInteractiveAuthentication no

Match Group ${VM_GROUP}
    AuthorizedKeysCommand /usr/local/sbin/hanasand-vm-authorized-keys %u
    AuthorizedKeysCommandUser root
    ForceCommand /usr/local/sbin/hanasand-vm-ssh-dispatch
    PermitTTY yes
    AllowTcpForwarding no
    X11Forwarding no
    PasswordAuthentication yes
    KbdInteractiveAuthentication no
CONF

    local emergency_ports=""
    for port in ${EMERGENCY_PORTS}; do
        emergency_ports="${emergency_ports}Port ${port}"$'\n'
    done
    awk '
        /^Port / { next }
        { print }
    ' /etc/ssh/sshd_config > /etc/ssh/sshd_config_hanasand_emergency.body
    {
        printf '%s' "${emergency_ports}"
        cat /etc/ssh/sshd_config_hanasand_emergency.body
    } > /etc/ssh/sshd_config_hanasand_emergency
    rm -f /etc/ssh/sshd_config_hanasand_emergency.body

    install -d -m 0755 /run/sshd
    sshd -t -f /etc/ssh/sshd_config_hanasand_gateway
    sshd -t -f /etc/ssh/sshd_config_hanasand_emergency
}

install_systemd_units() {
    local gateway_name="hanasand-ssh-gateway"
    if [ -n "${TEST_PORT}" ]; then
        gateway_name="hanasand-ssh-gateway-test"
    fi
    cat >"/etc/systemd/system/${gateway_name}.service" <<UNIT
[Unit]
Description=Hanasand SSH gateway
After=network.target docker.service snap.lxd.daemon.service

[Service]
ExecStartPre=/usr/bin/install -d -m 0755 /run/sshd
ExecStart=/usr/sbin/sshd -D -f /etc/ssh/sshd_config_hanasand_gateway -E /var/log/hanasand-ssh-gateway.log
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

    cat >/etc/systemd/system/hanasand-ssh-emergency.service <<'UNIT'
[Unit]
Description=Hanasand emergency direct SSH
After=network.target

[Service]
ExecStartPre=/usr/bin/install -d -m 0755 /run/sshd
ExecStart=/usr/sbin/sshd -D -f /etc/ssh/sshd_config_hanasand_emergency -E /var/log/hanasand-ssh-emergency.log
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    systemctl enable --now "${gateway_name}.service"
    if [ -z "${TEST_PORT}" ]; then
        systemctl enable --now hanasand-ssh-emergency.service
    fi
}

main() {
    require_root
    install_forgejo_helper
    install_forgejo_authorized_keys
    install_vm_authorized_keys
    install_vm_ssh_dispatch
    install_sync_ssh_users
    install_host_user
    install_sync_timer
    write_sshd_configs
    install_systemd_units
    /usr/local/sbin/hanasand-sync-ssh-users "$@"
}

main "$@"
