export function vmLoginUserData(name: string) {
    validateVmLoginName(name)
    return `#cloud-config\nhostname: ${name}\nmanage_etc_hosts: true\nusers:\n  - name: ${name}\n    shell: /bin/bash\n    lock_passwd: true\nruncmd:\n  - [sh, -lc, 'grep -Eq "^127\\.0\\.1\\.1[[:space:]]+.*[[:space:]]${name}([[:space:]]|$)|^127\\.0\\.1\\.1[[:space:]]+${name}([[:space:]]|$)" /etc/hosts || printf "127.0.1.1 ${name}\\n" >> /etc/hosts']\n`
}

export function validateVmLoginName(name: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name) || ['root', 'nobody'].includes(name)) throw new Error('Invalid VM login account.')
}
