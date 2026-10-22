import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { parse } from 'yaml'
import { vmSetupUserData } from '../src/utils/vms/vmSetupUserData.ts'
import { normalizeUbuntuAptPackages } from '../src/utils/vms/ubuntuAptPackages.ts'

test('generated cloud-init installs each catalog service and reports setup state', () => {
    const cloudInit = vmSetupUserData('builder-vm', {
        os: 'ubuntu-24.04',
        resources: { cpu: '4', memory: '8GiB', disk: '40GiB' },
        services: ['nodejs', 'bun', 'python', 'java', 'go', 'php', 'rust', 'ruby', 'cpp', 'docker', 'postgresql', 'mysql', 'sqlite', 'redis', 'nginx'],
    })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { users: Array<{ name: string }>, write_files: Array<{ path: string; content: string }>, runcmd: string[][] }
    const script = config.write_files.find(file => file.path === '/usr/local/sbin/hanasand-vm-setup')?.content

    expect(config.users[0]?.name).toBe('builder-vm')
    expect(script).toContain('nodesource.com/setup_24.x')
    expect(script).toContain('bun.sh/install')
    expect(script).toContain('postgresql postgresql-contrib')
    expect(script).toContain('mysql-server')
    expect(script).toContain('docker-ce docker-ce-cli containerd.io')
    expect(script).toContain('apt_packages+=(rustc cargo)')
    expect(script).toContain('apt_packages+=(ruby ruby-dev)')
    expect(script).toContain('apt_packages+=(build-essential)')
    expect(script).toContain('rustc --version; cargo --version')
    expect(script).toContain('ruby --version; gem --version')
    expect(script.indexOf('install -y --no-install-recommends ca-certificates curl gnupg unzip')).toBeLessThan(script.indexOf('nodesource.com/setup_24.x'))
    expect(script).toContain('write_state Running \'Setup complete\'')
    expect(config.runcmd.at(-1)).toEqual(['/usr/local/sbin/hanasand-vm-setup'])
    execFileSync('bash', ['-n'], { input: script })
})

test('website HTML is base64 encoded before insertion into the root-owned installer', () => {
    const html = '<script>unsafe()</script>'
    const cloudInit = vmSetupUserData('site-vm', { services: ['website'], websiteHtml: html })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const script = config.write_files[0]?.content

    expect(script).toContain(Buffer.from(html).toString('base64'))
    expect(script).not.toContain(html)
    expect(script).toContain('systemctl enable --now nginx')
    execFileSync('bash', ['-n'], { input: script })
})

test('Node.js and PostgreSQL setup waits for databases after startup', () => {
    const cloudInit = vmSetupUserData('hei', {
        os: 'ubuntu-26.04',
        resources: { cpu: '2', memory: '4GiB', disk: '20GiB' },
        services: ['nodejs', 'postgresql'],
    })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const script = config.write_files[0]?.content || ''

    expect(script.indexOf('systemctl enable --now postgresql')).toBeLessThan(script.indexOf('pg_isready'))
    expect(script).toContain('apt_packages+=(nodejs)')
    expect(script).toContain('if ! printf \'%s\' "$services" | grep -q \'"nodejs"\' || printf \'%s\' "$services" | grep -q \'"docker"\'; then')
    const nodeInstall = script.slice(script.indexOf('if printf \'%s\' "$services" | grep -q \'"nodejs"\'; then'), script.indexOf('if printf \'%s\' "$services" | grep -q \'"docker"\'; then'))
    expect(nodeInstall).not.toContain('apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq')
    execFileSync('bash', ['-n'], { input: script })
})

test('AI-selected Ubuntu packages are installed as package names, never shell commands', () => {
    const cloudInit = vmSetupUserData('custom-vm', { services: [], aptPackages: ['ruby-full', 'ripgrep'] })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const script = config.write_files[0]?.content || ''

    expect(script).toContain('apt_packages+=( \'ripgrep\' \'ruby-full\' )')
    expect(script).toContain('set_stage \'Refreshing package index\'')
    expect(script).toContain('apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 install -y --no-install-recommends "${apt_packages[@]}"')
    expect(() => vmSetupUserData('custom-vm', { services: [], aptPackages: ['curl;touch /tmp/pwned'] })).toThrow('valid Debian package identifiers')
    execFileSync('bash', ['-n'], { input: script })
})

test('Ubuntu package normalization rejects invalid, duplicate, and oversized lists', () => {
    expect(normalizeUbuntuAptPackages(undefined)).toEqual([])
    expect(normalizeUbuntuAptPackages(['ruby-full', 'ripgrep', 'ripgrep'])).toEqual(['ripgrep', 'ruby-full'])
    expect(normalizeUbuntuAptPackages('ripgrep')).toBeNull()
    expect(normalizeUbuntuAptPackages(['Ruby'])).toBeNull()
    expect(normalizeUbuntuAptPackages(['curl;touch /tmp/pwned'])).toBeNull()
    expect(normalizeUbuntuAptPackages(Array.from({ length: 13 }, (_, index) => `package-${index}`))).toBeNull()
})

test('setup failures persist the stage and line for VM status feedback', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-failure-'))
    try {
        const cloudInit = vmSetupUserData('hei', { services: ['postgresql'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${directory}/status'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('set_stage \'Preparing selected services\'', 'set_stage \'Preparing selected services\'\nfalse')

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8' })
        expect(result.status).not.toBe(0)
        const [state, message] = readFileSync(join(directory, 'status'), 'utf8').trim().split('\t')
        expect(state).toBe('Error')
        expect(message).toMatch(/^Service setup failed during Preparing selected services\. Check VM logs for details \(line \d+\)\.$/)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('Java uses the distribution JDK and Minecraft downloads a Java 25 runtime', () => {
    for (const service of ['java', 'minecraft-java'] as const) {
        const cloudInit = vmSetupUserData('runtime-vm', { services: [service] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content || ''
        expect(script).toContain(`"${service}"`)
        if (service === 'java') {
            expect(script).toContain('apt_packages+=(default-jdk-headless)')
        } else {
            expect(script).toContain('java_version=25')
            expect(script).toContain('java_image_type=jre')
            expect(script).toContain('v3/binary/latest/$java_version/ga/linux/$java_arch/$java_image_type/hotspot/normal/eclipse')
            expect(script).toContain('set_stage "Installing Java $java_version"')
        }
        execFileSync('bash', ['-n'], { input: script })
    }
})

test('Minecraft setup resolves official server builds and starts a dedicated systemd service', () => {
    for (const serverType of ['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'NEOFORGE', 'PURPUR', 'FOLIA'] as const) {
        const cloudInit = vmSetupUserData('game-vm', { services: ['minecraft-java'], minecraftServerType: serverType, minecraftEulaAccepted: true })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
        expect(script).toContain('hanasand-minecraft.service')
        expect(script).toContain('eula=true')
        expect(script).not.toContain('not available yet')
        execFileSync('bash', ['-n'], { input: script })
    }
})
