import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { parse } from 'yaml'
import { vmSetupUserData } from '../src/utils/vms/vmSetupUserData.ts'
import { normalizeAptPackages } from '../src/utils/vms/aptPackages.ts'
import { supportedSetupServices } from '../src/utils/vms/supportedSetupServices.ts'
import { vmServices } from '../../frontend/src/utils/vms/createOptions.ts'

test('the server setup generator covers every service advertised in the VM builder', () => {
    const advertised = vmServices.map(service => service.id).sort()
    expect([...supportedSetupServices].sort()).toEqual(advertised)

    for (const os of ['ubuntu-24.04', 'debian-13'] as const) {
        for (const service of advertised) {
            const cloudInit = vmSetupUserData('catalog-vm', { os, services: [service] })
            const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
            const script = config.write_files[0]?.content || ''
            expect(script).toContain(`"${service}"`)
            execFileSync('bash', ['-n'], { input: script })
        }
    }
})

test('generated cloud-init installs each catalog service and reports setup state', () => {
    const cloudInit = vmSetupUserData('builder-vm', {
        os: 'ubuntu-24.04',
        resources: { cpu: '4', memory: '8GiB', disk: '40GiB' },
        services: ['nodejs', 'bun', 'python', 'java', 'go', 'php', 'rust', 'ruby', 'cpp', 'docker', 'postgresql', 'mysql', 'sqlite', 'redis', 'nginx'],
    })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { users: Array<{ name: string }>, write_files: Array<{ path: string; content: string }>, runcmd: string[][] }
    const script = config.write_files.find(file => file.path === '/usr/local/sbin/hanasand-vm-setup')?.content

    expect(config.users[0]?.name).toBe('builder-vm')
    expect(script).toContain('https://nodejs.org/dist/')
    expect(script).toContain('SHASUMS256.txt')
    expect(script).not.toContain('nodesource')
    expect(script).toContain('bun.sh/install')
    expect(script).toContain('export HOME=/root')
    expect(script).toContain('postgresql postgresql-contrib')
    expect(script).toContain('mysql-server')
    expect(script).toContain('docker-ce docker-ce-cli containerd.io')
    expect(script).toContain("wait_for_ready 'Docker daemon' docker info")
    expect(script.indexOf("wait_for_ready 'Docker daemon' docker info")).toBeLessThan(script.indexOf("docker version --format"))
    expect(script).toContain('apt_packages+=(rustc cargo)')
    expect(script).toContain('apt_packages+=(ruby ruby-dev)')
    expect(script).toContain('apt_packages+=(build-essential)')
    expect(script).toContain('rustc --version; cargo --version')
    expect(script).toContain('ruby --version; gem --version')
    expect(script).toContain('apt_packages+=(ca-certificates curl unzip)')
    expect(script).toContain('Installing Node.js 24 LTS')
    expect(script).toContain('The downloaded Node.js archive failed its checksum check.')
    expect(script).toContain('tarfile.open(archive, mode="r:xz")')
    expect(script).toContain('The Node.js archive contains an unsafe path.')
    expect(script).toContain('docker.asc')
    expect(script).toContain('case "$ID" in ubuntu|debian) docker_distribution=$ID')
    expect(script).toContain('fetch_apt_key "https://download.docker.com/linux/$docker_distribution/gpg" /etc/apt/keyrings/docker.asc')
    expect(script).toContain('https://download.docker.com/linux/%s %s stable')
    expect(script).toContain('urlopen(sys.argv[1], timeout=30)')
    expect(script).toContain('run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq')
    expect(script).toContain('Dpkg::Progress-Fd=3 install -y --no-install-recommends')
    expect(script).toContain('set_stage "Installing ${apt_progress}"')
    expect(script).toContain('while kill -0 "$apt_install_pid"')
    expect(script).toContain('command timeout --signal=TERM --kill-after=10s 190s curl --connect-timeout 15 --max-time 180')
    expect(script).toContain('write_state Running \'Setup complete\'')
    expect(config.runcmd.at(-1)).toEqual(['/usr/local/sbin/hanasand-vm-setup'])
    execFileSync('bash', ['-n'], { input: script })
})

test('Debian 13 cloud-init installs Docker from the Debian repository and retains apt-based services', () => {
    const cloudInit = vmSetupUserData('debian-vm', {
        os: 'debian-13',
        services: ['docker', 'nodejs', 'postgresql', 'nginx'],
    })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const script = config.write_files[0]?.content || ''

    expect(script).toContain('docker_distribution=$ID')
    expect(script).toContain('https://download.docker.com/linux/%s %s stable')
    expect(script).toContain('apt_packages+=(docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin)')
    expect(script).toContain('apt_packages+=(postgresql postgresql-contrib)')
    expect(script).toContain('systemctl enable --now postgresql')
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

test('selecting Website alone starts Nginx and waits for its HTTP endpoint', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-website-ready-'))
    try {
        const bin = join(directory, 'bin')
        const statusPath = join(directory, 'status')
        const serviceLog = join(directory, 'services.log')
        mkdirSync(bin)
        writeFileSync(join(bin, 'apt-get'), '#!/usr/bin/env bash\nexit 0\n')
        writeFileSync(join(bin, 'systemctl'), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> '${serviceLog}'\nexit 0\n`)
        writeFileSync(join(bin, 'nginx'), '#!/usr/bin/env bash\nexit 0\n')
        writeFileSync(join(bin, 'curl'), '#!/usr/bin/env bash\nexit 0\n')
        writeFileSync(join(bin, 'chown'), '#!/usr/bin/env bash\nexit 0\n')
        for (const executable of ['apt-get', 'systemctl', 'nginx', 'curl', 'chown']) chmodSync(join(bin, executable), 0o755)

        const cloudInit = vmSetupUserData('site-vm', { services: ['website'], websiteHtml: '<main>It works</main>' })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('mktemp /run/hanasand-apt-progress.XXXXXX', `mktemp '${directory}/apt-progress.XXXXXX'`)
            .replaceAll('/var/www/html', `${directory}/www`)
            .replace('    sleep 2\n  done\n  update_apt_progress', '    sleep 0.01\n  done\n  update_apt_progress')
        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
        expect(readFileSync(serviceLog, 'utf8')).toContain('enable --now nginx')
        expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('cloud-init copies a validated Next.js project into the guest and builds it as the VM user', () => {
    const files = [
        {
            path: 'package.json',
            content: JSON.stringify({
                private: true,
                scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' },
                dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' },
            }),
        },
        { path: 'app/page.tsx', content: 'export default function Home() { return <main>It works</main> }' },
    ]
    const cloudInit = vmSetupUserData('builder-vm', {
        resources: { cpu: '2', memory: '4GiB', disk: '20GiB' },
        services: ['nodejs'],
        nextjsProjectFiles: files,
    })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ path: string, content: string, encoding?: string, owner?: string }> }
    const projectPackage = config.write_files.find(file => file.path === '/home/builder-vm/project/package.json')
    const page = config.write_files.find(file => file.path === '/home/builder-vm/project/app/page.tsx')
    const unit = config.write_files.find(file => file.path === '/etc/systemd/system/hanasand-nextjs.service')
    const script = config.write_files.find(file => file.path === '/usr/local/sbin/hanasand-vm-setup')?.content || ''

    expect(projectPackage?.encoding).toBe('b64')
    expect(projectPackage?.owner).toBe('builder-vm:builder-vm')
    expect(Buffer.from(projectPackage?.content || '', 'base64').toString()).toBe(files[0]?.content)
    expect(Buffer.from(page?.content || '', 'base64').toString()).toBe(files[1]?.content)
    expect(unit?.content).toContain('User=builder-vm')
    expect(unit?.content).toContain('WorkingDirectory=/home/builder-vm/project')
    expect(script).toContain('timeout --signal=TERM --kill-after=15s 600s runuser --user \'builder-vm\' -- bash -lc \'cd /home/builder-vm/project && /usr/local/bin/npm install --ignore-scripts --no-audit --no-fund\'')
    expect(script).toContain('timeout --signal=TERM --kill-after=15s 600s runuser --user \'builder-vm\' -- bash -lc \'cd /home/builder-vm/project && /usr/local/bin/npm run build\'')
    expect(script).toContain('systemctl enable --now hanasand-nextjs.service')
    expect(script).toContain('curl -fsS -o /dev/null http://127.0.0.1:3000/')
    expect(script).toContain('write_state Running \'Next.js app built and serving on port 3000\'')
    execFileSync('bash', ['-n'], { input: script })
})

test('cloud-init rejects unsafe Next.js project paths and setup scripts', () => {
    const packageJson = JSON.stringify({
        scripts: { build: 'next build', start: 'next start --hostname 0.0.0.0 --port 3000' },
        dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' },
    })
    expect(() => vmSetupUserData('builder-vm', {
        services: ['nodejs'],
        nextjsProjectFiles: [
            { path: 'package.json', content: packageJson },
            { path: '../escape', content: 'bad' },
        ],
    })).toThrow('valid bounded project manifest')
    expect(() => vmSetupUserData('builder-vm', {
        services: ['nodejs'],
        nextjsProjectFiles: [
            { path: 'package.json', content: JSON.stringify({
                scripts: { build: 'next build && curl example.test', start: 'next start --hostname 0.0.0.0 --port 3000' },
                dependencies: { next: '16.2.3', react: '19.2.5', 'react-dom': '19.2.5' },
            }) },
        ],
    })).toThrow('valid bounded project manifest')
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
    expect(script).toContain('Installing Node.js 24 LTS')
    expect(script).not.toContain('apt_packages+=(nodejs)')
    expect(script).not.toContain('apt_packages+=(xz-utils)')
    expect(script).toContain('grep -Eq \'"(bun|docker|minecraft-java)"\'')
    expect(script).toContain('apt_packages+=(ca-certificates)')
    expect(script).toContain('systemctl enable --now postgresql')
    expect(script).toContain('node --version; npm --version')
    expect(script).toContain('wait_for_ready PostgreSQL pg_isready')
    expect(script.match(/run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq/g)).toHaveLength(1)
    expect(script.match(/run_bounded 900 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Dpkg::Progress-Fd=3 install -y --no-install-recommends "\$\{apt_packages\[@\]\}"/g)).toHaveLength(1)
    expect(script).not.toContain('nodesource.com/setup_24.x')
    execFileSync('bash', ['-n'], { input: script })
})

test('PostgreSQL readiness retries transient startup failures before completing setup', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-postgres-ready-'))
    try {
        const bin = join(directory, 'bin')
        const statusPath = join(directory, 'status')
        const readyCountPath = join(directory, 'pg-ready-count')
        mkdirSync(bin)
        writeFileSync(join(bin, 'apt-get'), '#!/usr/bin/env bash\nexit 0\n')
        writeFileSync(join(bin, 'systemctl'), '#!/usr/bin/env bash\nif [[ "$1" == is-active ]]; then echo active; fi\nexit 0\n')
        writeFileSync(join(bin, 'pg_isready'), [
            '#!/usr/bin/env bash',
            `count="$(cat '${readyCountPath}' 2>/dev/null || printf 0)"`,
            'count=$((count + 1))',
            `printf '%s' "$count" > '${readyCountPath}'`,
            '(( count >= 3 ))',
        ].join('\n'))
        for (const executable of ['apt-get', 'systemctl', 'pg_isready']) chmodSync(join(bin, executable), 0o755)

        const cloudInit = vmSetupUserData('hei', { services: ['postgresql'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('mktemp /run/hanasand-apt-progress.XXXXXX', `mktemp '${directory}/apt-progress.XXXXXX'`)
            .replace('    sleep 2\n  done\n  update_apt_progress', '    sleep 0.01\n  done\n  update_apt_progress')
            .replace('    sleep 1\n  done', '    sleep 0.01\n  done')

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
        expect(readFileSync(readyCountPath, 'utf8')).toBe('3')
        expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('MySQL and Redis readiness retry transient startup failures', () => {
    for (const service of ['mysql', 'redis'] as const) {
        const directory = mkdtempSync(join(tmpdir(), `vm-setup-${service}-ready-`))
        try {
            const bin = join(directory, 'bin')
            const statusPath = join(directory, 'status')
            const readyCountPath = join(directory, 'ready-count')
            mkdirSync(bin)
            writeFileSync(join(bin, 'apt-get'), '#!/usr/bin/env bash\nexit 0\n')
            writeFileSync(join(bin, 'systemctl'), '#!/usr/bin/env bash\nexit 0\n')
            const readyCommand = service === 'mysql' ? 'mysqladmin' : 'redis-cli'
            const probe = service === 'mysql'
                ? '(( count >= 3 ))'
                : 'if (( count >= 3 )); then echo PONG; else echo LOADING; fi'
            writeFileSync(join(bin, readyCommand), [
                '#!/usr/bin/env bash',
                `count="$(cat '${readyCountPath}' 2>/dev/null || printf 0)"`,
                'count=$((count + 1))',
                `printf '%s' "$count" > '${readyCountPath}'`,
                probe,
            ].join('\n'))
            for (const executable of ['apt-get', 'systemctl', readyCommand]) chmodSync(join(bin, executable), 0o755)

            const cloudInit = vmSetupUserData(`ready-${service}`, { services: [service] })
            const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
            const script = config.write_files[0]?.content
                .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
                .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
                .replace('mktemp /run/hanasand-apt-progress.XXXXXX', `mktemp '${directory}/apt-progress.XXXXXX'`)
                .replace('    sleep 2\n  done\n  update_apt_progress', '    sleep 0.01\n  done\n  update_apt_progress')
                .replace('    sleep 1\n  done', '    sleep 0.01\n  done')
            const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
            if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
            expect(readFileSync(readyCountPath, 'utf8')).toBe('3')
            expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
        } finally {
            rmSync(directory, { recursive: true, force: true })
        }
    }
})

test('apt package installation writes meaningful progress to the VM status file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-progress-'))
    try {
        const bin = join(directory, 'bin')
        const statusPath = join(directory, 'status')
        const progressLog = join(directory, 'progress.log')
        mkdirSync(bin)
        const fakeAptGet = join(bin, 'apt-get')
        writeFileSync(fakeAptGet, [
            '#!/usr/bin/env bash',
            'if [[ " $* " == *" install "* ]]; then',
            '  printf \'pmstatus:ripgrep:40.0000:Unpacking\\n\' >&3',
            '  sleep 0.3',
            '  printf \'pmstatus:ripgrep:100.0000:Unpacking\\n\' >&3',
            'fi',
        ].join('\n'))
        chmodSync(fakeAptGet, 0o755)

        const cloudInit = vmSetupUserData('progress-vm', { aptPackages: ['ripgrep'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('mktemp /run/hanasand-apt-progress.XXXXXX', `mktemp '${directory}/apt-progress.XXXXXX'`)
            .replace('    sleep 2\n  done\n  update_apt_progress', '    sleep 0.1\n  done\n  update_apt_progress')
            .replace('set_stage() { setup_stage=$1; write_state Provisioning "$1"; }', `set_stage() { setup_stage=$1; write_state Provisioning "$1"; printf '%s\\n' "$1" >> '${progressLog}'; }`)

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
        expect(readFileSync(progressLog, 'utf8')).toContain('Installing ripgrep 40%')
        expect(readFileSync(progressLog, 'utf8')).toContain('Installing ripgrep 100%')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('AI-selected Ubuntu packages are installed as package names, never shell commands', () => {
    const cloudInit = vmSetupUserData('custom-vm', { services: [], aptPackages: ['ruby-full', 'ripgrep'] })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const script = config.write_files[0]?.content || ''

    expect(script).toContain('apt_packages+=( \'ripgrep\' \'ruby-full\' )')
    expect(script).toContain('run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq')
    expect(script).toContain('Dpkg::Progress-Fd=3 install -y --no-install-recommends "${apt_packages[@]}"')
    expect(() => vmSetupUserData('custom-vm', { services: [], aptPackages: ['curl;touch /tmp/pwned'] })).toThrow('valid Debian package identifiers')
    execFileSync('bash', ['-n'], { input: script })
})

test('Ubuntu package normalization rejects invalid, duplicate, and oversized lists', () => {
    expect(normalizeAptPackages(undefined)).toEqual([])
    expect(normalizeAptPackages(['ruby-full', 'ripgrep', 'ripgrep'])).toEqual(['ripgrep', 'ruby-full'])
    expect(normalizeAptPackages('ripgrep')).toBeNull()
    expect(normalizeAptPackages(['Ruby'])).toBeNull()
    expect(normalizeAptPackages(['curl;touch /tmp/pwned'])).toBeNull()
    expect(normalizeAptPackages(Array.from({ length: 13 }, (_, index) => `package-${index}`))).toBeNull()
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

test('a stalled package install hits its deadline and reports a visible setup error', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-timeout-'))
    try {
        const cloudInit = vmSetupUserData('hei', { services: ['postgresql'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${directory}/status'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update -qq', 'run_bounded 1 sleep 0')
            .replace('run_bounded 900 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Dpkg::Progress-Fd=3 install -y --no-install-recommends "${apt_packages[@]}" 3>"$apt_progress_file" &', 'run_bounded 1 sleep 3 &')

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8' })
        expect(result.status).not.toBe(0)
        const [state, message] = readFileSync(join(directory, 'status'), 'utf8').trim().split('\t')
        expect(state).toBe('Error')
        expect(message).toMatch(/^Service setup failed during Installing selected packages\./)
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
            expect(script).toContain('v3/assets/latest/{java_version}/hotspot?{asset_query}')
            expect(script).toContain('Range')
            expect(script).toContain('Content-Range')
            expect(script).toContain('checksum_link')
            expect(script).toContain('The downloaded Java archive failed its checksum check.')
            expect(script).toContain('run_bounded 1800 python3')
            expect(script).toContain('set_stage "Installing Java $java_version"')
        }
        execFileSync('bash', ['-n'], { input: script })
    }
})

test.serial('Java archive download resumes a partial transfer and verifies its checksum before extraction', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-java-download-'))
    const archive = join(directory, 'java.tar.gz')
    const payload = Buffer.from('bounded fixture for the Java archive downloader')
    const digest = await Bun.CryptoHasher.hash('sha256', payload, 'hex')

    try {
        const cloudInit = vmSetupUserData('runtime-vm', { services: ['minecraft-java'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const setupScript = config.write_files[0]?.content || ''
        const marker = 'run_bounded 1800 python3 - "$java_version" "$java_arch" "$java_image_type" <<\'PY\'\n'
        const start = setupScript.indexOf(marker)
        const end = setupScript.indexOf('\nPY\n  java_extract_dir=', start)
        expect(start).toBeGreaterThanOrEqual(0)
        expect(end).toBeGreaterThan(start)
        const fakeTransport = `
import base64
import io

fixture = base64.b64decode(${JSON.stringify(payload.toString('base64'))})
fixture_checksum = ${JSON.stringify(digest)}
download_requests = 0
observed_range = ""

class FakeResponse(io.BytesIO):
    def __init__(self, body, status=200, headers=None):
        super().__init__(body)
        self.status = status
        self.headers = headers or {}
    def __enter__(self): return self
    def __exit__(self, *args): self.close()
    def read1(self, size=-1): return self.read(size)

def fake_urlopen(request, timeout=0):
    global download_requests, observed_range
    url = request.full_url if hasattr(request, "full_url") else request
    if "/assets/latest/" in url:
        link = "https://downloads.example/java.tar.gz"
        metadata = [{"binary": {"package": {"link": link, "checksum_link": link + ".sha256.txt", "size": len(fixture)}}}]
        return FakeResponse(json.dumps(metadata).encode())
    if url.endswith(".sha256.txt"):
        return FakeResponse((fixture_checksum + "  java.tar.gz\\n").encode())
    download_requests += 1
    headers = request.headers if hasattr(request, "headers") else {}
    observed_range = headers.get("Range", "")
    if not observed_range:
        split = len(fixture) // 2
        return FakeResponse(fixture[:split])
    offset = int(observed_range.removeprefix("bytes=").removesuffix("-"))
    return FakeResponse(fixture[offset:], status=206, headers={"Content-Range": f"bytes {offset}-{len(fixture) - 1}/{len(fixture)}"})

urllib.request.urlopen = fake_urlopen
`
        const downloader = setupScript.slice(start + marker.length, end)
            .replace('import urllib.request', `import urllib.request${fakeTransport}`)
            .replace('pathlib.Path(f"/tmp/hanasand-java{java_version}.tar.gz")', `pathlib.Path(${JSON.stringify(archive)})`)
            + '\nprint(f"DOWNLOAD_REQUESTS={download_requests};RANGE={observed_range}")\n'
        const result = await new Promise<{ status: number | null, stdout: string, stderr: string }>((resolve, reject) => {
            const child = spawn('python3', ['-c', downloader, '25', 'x64', 'jre'])
            let stdout = '', stderr = ''
            child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
            child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
            child.on('error', reject)
            child.on('close', status => resolve({ status, stdout, stderr }))
        })
        if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Python exited ${result.status}`)
        expect(result.stderr).toBe('')
        expect(result.stdout).toMatch(/DOWNLOAD_REQUESTS=2;RANGE=bytes=\d+-/)
        expect(readFileSync(archive)).toEqual(payload)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('Minecraft setup resolves official server builds and starts a dedicated systemd service', () => {
    for (const serverType of ['PAPER', 'VANILLA', 'FABRIC', 'QUILT', 'FORGE', 'NEOFORGE', 'PURPUR', 'FOLIA'] as const) {
        const cloudInit = vmSetupUserData('game-vm', { services: ['minecraft-java'], minecraftServerType: serverType, minecraftEulaAccepted: true })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
        expect(script).toContain('hanasand-minecraft.service')
        expect(script).toContain('eula=true')
        expect(script).not.toContain('not available yet')
        if (serverType === 'FORGE') expect(script).toContain('maven.minecraftforge.net')
        execFileSync('bash', ['-n'], { input: script })
    }
    const cloudInit = vmSetupUserData('game-vm', {
        services: ['minecraft-java'], minecraftServerType: 'FABRIC', minecraftEulaAccepted: true,
        minecraftAddons: ['fabric-api', 'lithium'],
    })
    const script = (parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }).write_files[0]?.content || ''
    expect(script).toContain('api.modrinth.com/v2/project/')
    expect(script).toContain('cdn.modrinth.com')
    expect(script).toContain('hashlib.sha512')
    expect(script).toContain('/opt/minecraft/mods')
    expect(script).toContain(String.raw`re.fullmatch(r'\d+(?:\.\d+){1,3}', game_version)`)
    execFileSync('bash', ['-n'], { input: script })
})
