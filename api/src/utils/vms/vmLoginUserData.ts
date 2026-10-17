export function vmLoginUserData(name: string) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(name) || ['root', 'nobody'].includes(name)) throw new Error('Invalid VM login account.')
    return `#cloud-config\nusers:\n  - name: ${name}\n    shell: /bin/bash\n    lock_passwd: true\n`
}
