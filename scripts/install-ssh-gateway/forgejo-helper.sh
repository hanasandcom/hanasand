# Sourced by ../install-ssh-gateway.sh.
install_forgejo_helper() {
    install -d -m 0755 /usr/local/src /usr/local/sbin
    cat >/usr/local/src/forgejo-gitea-serv.c <<'C'
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#ifndef FORGEJO_CONTAINER
#define FORGEJO_CONTAINER "git_ui"
#endif

#ifndef FORGEJO_APP_INI
#define FORGEJO_APP_INI "/data/gitea/conf/app.ini"
#endif

static int valid_key(const char *s) {
    if (strncmp(s, "key-", 4) != 0) return 0;
    if (!isdigit((unsigned char)s[4])) return 0;
    for (const char *p = s + 4; *p; ++p) {
        if (!isdigit((unsigned char)*p)) return 0;
    }
    return 1;
}

int main(int argc, char **argv) {
    char expected_config[256];
    snprintf(expected_config, sizeof(expected_config), "--config=%s", FORGEJO_APP_INI);

    if (argc != 4 || strcmp(argv[1], expected_config) != 0 || strcmp(argv[2], "serv") != 0 || !valid_key(argv[3])) {
        fprintf(stderr, "Unsupported Forgejo SSH command.\n");
        return 1;
    }

    if (setgid(0) != 0 || setuid(0) != 0) {
        perror("setuid/setgid");
        return 1;
    }

    const char *original_command = getenv("SSH_ORIGINAL_COMMAND");
    char original_command_env[8192];
    if (original_command == NULL) {
        original_command = "";
    }
    if (snprintf(original_command_env, sizeof(original_command_env), "SSH_ORIGINAL_COMMAND=%s", original_command) >= (int)sizeof(original_command_env)) {
        fprintf(stderr, "SSH_ORIGINAL_COMMAND is too long.\n");
        return 1;
    }

    char *cmd[] = {
        "/usr/bin/docker", "exec", "-i", "--user", "git", "-e", original_command_env, FORGEJO_CONTAINER,
        "/usr/local/bin/gitea", argv[1], argv[2], argv[3], NULL
    };
    execv(cmd[0], cmd);
    perror("execv docker");
    return 1;
}
C
    gcc -O2 -Wall -Wextra \
        -DFORGEJO_CONTAINER="\"${FORGEJO_CONTAINER}\"" \
        -DFORGEJO_APP_INI="\"${FORGEJO_APP_INI}\"" \
        -o /usr/local/sbin/forgejo-gitea-serv /usr/local/src/forgejo-gitea-serv.c
    chown root:root /usr/local/sbin/forgejo-gitea-serv
    chmod 4755 /usr/local/sbin/forgejo-gitea-serv

    cat >/usr/local/bin/gitea <<'SH'
#!/usr/bin/env bash
exec /usr/local/sbin/forgejo-gitea-serv "$@"
SH
    chmod 0755 /usr/local/bin/gitea
}
