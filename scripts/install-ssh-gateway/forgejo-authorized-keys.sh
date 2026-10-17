# Sourced by ../install-ssh-gateway.sh.
install_forgejo_authorized_keys() {
    install -d -m 0755 /usr/local/sbin
    cat >/usr/local/src/hanasand-forgejo-authorized-keys-read.c <<'C'
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <sys/stat.h>
#include <unistd.h>

#ifndef FORGEJO_AUTHORIZED_KEYS
#define FORGEJO_AUTHORIZED_KEYS "/var/lib/docker/volumes/git_git_data/_data/git/.ssh/authorized_keys"
#endif

int main(int argc, char **argv) {
    (void)argv;
    if (argc != 1) {
        fprintf(stderr, "Unexpected arguments.\n");
        return 2;
    }

    int input = open(FORGEJO_AUTHORIZED_KEYS, O_RDONLY | O_CLOEXEC | O_NOFOLLOW);
    if (input < 0) {
        perror("open authorized_keys");
        return 1;
    }

    struct stat info;
    if (fstat(input, &info) != 0 || !S_ISREG(info.st_mode)) {
        fprintf(stderr, "authorized_keys is not a regular file.\n");
        close(input);
        return 1;
    }

    char buffer[8192];
    for (;;) {
        ssize_t bytes = read(input, buffer, sizeof(buffer));
        if (bytes == 0) break;
        if (bytes < 0) {
            if (errno == EINTR) continue;
            perror("read authorized_keys");
            close(input);
            return 1;
        }
        ssize_t offset = 0;
        while (offset < bytes) {
            ssize_t written = write(STDOUT_FILENO, buffer + offset, (size_t)(bytes - offset));
            if (written < 0) {
                if (errno == EINTR) continue;
                perror("write authorized_keys");
                close(input);
                return 1;
            }
            offset += written;
        }
    }

    close(input);
    return 0;
}
C
    gcc -O2 -Wall -Wextra \
        -DFORGEJO_AUTHORIZED_KEYS="\"${FORGEJO_AUTHORIZED_KEYS}\"" \
        -o /usr/local/sbin/hanasand-forgejo-authorized-keys-read /usr/local/src/hanasand-forgejo-authorized-keys-read.c
    chown root:root /usr/local/sbin/hanasand-forgejo-authorized-keys-read
    chmod 0755 /usr/local/sbin/hanasand-forgejo-authorized-keys-read

    cat >/usr/local/sbin/forgejo-authorized-keys <<SH
#!/usr/bin/env bash
set -euo pipefail
trap '' PIPE
[ "\${1:-}" = "git" ] || exit 1
output=\$(/usr/local/sbin/hanasand-forgejo-authorized-keys-read 2>/dev/null || true)
if [ -n "\$output" ]; then
    printf '%s\\n' "\$output" || true
fi
exit 0
SH
    chmod 0755 /usr/local/sbin/forgejo-authorized-keys
    install -d -m 0755 /var/lib/hanasand-ssh-gateway/home/git
    if ! id git >/dev/null 2>&1; then
        useradd -M -N -r -d /var/lib/hanasand-ssh-gateway/home/git -s /bin/bash git
    fi
    usermod -d /var/lib/hanasand-ssh-gateway/home/git -s /bin/bash git
    usermod -p '!' git >/dev/null 2>&1 || true

}
