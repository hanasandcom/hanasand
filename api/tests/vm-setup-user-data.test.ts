import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { parse } from 'yaml'
import { vmSetupUserData } from '../src/utils/vms/vmSetupUserData.ts'
import { normalizeUbuntuAptPackages } from '../src/utils/vms/ubuntuAptPackages.ts'
import { supportedSetupServices } from '../src/utils/vms/supportedSetupServices.ts'
import { vmServices } from '../../frontend/src/utils/vms/createOptions.ts'

test('the server setup generator covers every service advertised in the VM builder', () => {
    const advertised = vmServices.map(service => service.id).sort()
    expect([...supportedSetupServices].sort()).toEqual(advertised)

    for (const service of advertised) {
        const cloudInit = vmSetupUserData('catalog-vm', { services: [service] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content || ''
        expect(script).toContain(`"${service}"`)
        execFileSync('bash', ['-n'], { input: script })
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
    expect(script).toContain('apt_packages+=(rustc cargo)')
    expect(script).toContain('apt_packages+=(ruby ruby-dev)')
    expect(script).toContain('apt_packages+=(build-essential)')
    expect(script).toContain('rustc --version; cargo --version')
    expect(script).toContain('ruby --version; gem --version')
    expect(script).toContain('apt_packages+=(ca-certificates curl unzip)')
    expect(script).toContain('Installing Node.js 24 LTS')
    expect(script).toContain('Node.js archive download failed after retries:')
    expect(script).toContain('Incomplete Node.js archive:')
    expect(script).toContain('The downloaded Node.js archive failed its checksum check.')
    expect(script).toContain('tarfile.open(archive, mode="r:xz")')
    expect(script).toContain('The Node.js archive contains an unsafe path.')
    expect(script).toContain('docker.asc')
    expect(script).toContain('fetch_apt_key https://download.docker.com/linux/ubuntu/gpg /etc/apt/keyrings/docker.asc')
    expect(script).toContain('urlopen(sys.argv[1], timeout=30)')
    expect(script).toContain('run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 --error-on=any update -qq')
    expect(script).toContain('DPkg::Lock::Timeout=600 -o Dpkg::Progress-Fd=3 install -y --no-install-recommends')
    expect(script).toContain('run_bounded 1800 apt-get')
    expect(script).toContain('Recovering interrupted package configuration')
    expect(script).toContain('run_bounded 1800 dpkg --configure -a')
    expect(script).toContain('set_stage "Installing ${apt_progress}"')
    expect(script).toContain('while kill -0 "$apt_install_pid"')
    expect(script).toContain('command timeout --signal=TERM --kill-after=10s 190s curl --connect-timeout 15 --max-time 180')
    expect(script).toContain('write_state Running \'Setup complete\'')
    expect(config.runcmd.at(-1)).toEqual(['/usr/local/sbin/hanasand-vm-setup'])
    execFileSync('bash', ['-n'], { input: script })
})

test('Debian Docker setup uses Debian repositories and Enterprise Linux accepts every catalog service', () => {
    const debian = vmSetupUserData('debian-docker', { os: 'debian-13', services: ['docker'] })
    const debianConfig = parse(debian.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const debianScript = debianConfig.write_files[0]?.content || ''
    expect(debianScript).toContain('https://download.docker.com/linux/%s %s stable')
    expect(debianScript).toContain('debian) docker_distro=debian ;;')

    const debianMysql = vmSetupUserData('debian-mysql', { os: 'debian-13', services: ['mysql'] })
    const debianMysqlConfig = parse(debianMysql.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const debianMysqlScript = debianMysqlConfig.write_files[0]?.content || ''
    expect(debianMysqlScript).toContain('apt_packages+=(default-mysql-server)')
    expect(debianMysqlScript).toContain('systemctl enable --now mariadb')
    expect(debianMysqlScript).not.toContain('apt_packages+=(mysql-server)')

    const ubuntuMysql = vmSetupUserData('ubuntu-mysql', { os: 'ubuntu-24.04', services: ['mysql'] })
    const ubuntuMysqlConfig = parse(ubuntuMysql.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const ubuntuMysqlScript = ubuntuMysqlConfig.write_files[0]?.content || ''
    expect(ubuntuMysqlScript).toContain('apt_packages+=(mysql-server)')
    expect(ubuntuMysqlScript).toContain('systemctl enable --now mysql')

    const kali = vmSetupUserData('kali-docker', { os: 'kali', services: ['docker'] })
    const kaliConfig = parse(kali.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const kaliScript = kaliConfig.write_files[0]?.content || ''
    expect(kaliScript).toContain('kali) docker_distro=debian; docker_release=trixie ;;')
    execFileSync('bash', ['-n'], { input: kaliScript })

    for (const os of ['fedora-44', 'almalinux-9', 'rocky-9', 'centos-stream-10'] as const) {
        const cloudInit = vmSetupUserData('enterprise-linux', { os, services: [...supportedSetupServices] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content || ''
        expect(script).toContain('dnf install -y --setopt=retries=2 --setopt=timeout=30 "${packages[@]}"')
        expect(script).toContain('packages=(ca-certificates unzip)')
        expect(script).not.toContain('packages=(ca-certificates curl unzip)')
        expect(script).toContain('command timeout --signal=TERM --kill-after=10s 190s curl')
        expect(script).toContain('Package repositories unavailable; retrying')
        expect(script).toContain('dnf clean metadata')
        expect(script).toContain('postgresql-server postgresql-contrib')
        expect(script).toContain('mariadb-server')
        expect(script).toContain('packages+=(python3)')
        expect(script).toContain('packages+=(tar)')
        expect(script).not.toContain('java-21-openjdk-devel')
        expect(script).toContain('"(nodejs|java|minecraft-java)"')
        expect(script).toContain('systemctl enable --now mariadb')
        expect(script).toContain('systemctl enable --now redis')
        expect(script).toContain('Installing Composer')
        expect(script).toContain('docker-ce docker-ce-cli containerd.io')
        expect(script).toContain('docker_rpm_release=rhel')
        expect(script).toContain('[[ "$ID" == fedora ]] && docker_rpm_release=fedora')
        expect(script).not.toContain('dnf-plugins-core')
        expect(script).not.toContain('dnf5-plugins')
        expect(script).not.toContain('Unsupported Rocky Linux package')
        execFileSync('bash', ['-n'], { input: script })
    }
})

test.serial('Fedora Docker setup writes the official DNF5 repository without a plugin bootstrap', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-fedora-docker-'))
    try {
        const bin = join(directory, 'bin')
        const logPath = join(directory, 'commands')
        const statusPath = join(directory, 'status')
        mkdirSync(bin)
        writeFileSync(join(bin, 'dnf'), `#!/usr/bin/env bash\nprintf 'dnf %s\\n' "$*" >> '${logPath}'\n`)
        writeFileSync(join(bin, 'systemctl'), `#!/usr/bin/env bash\nprintf 'systemctl %s\\n' "$*" >> '${logPath}'\n`)
        writeFileSync(join(bin, 'docker'), `#!/usr/bin/env bash\nprintf 'docker %s\\n' "$*" >> '${logPath}'\n`)
        writeFileSync(join(bin, 'usermod'), `#!/usr/bin/env bash\nprintf 'usermod %s\\n' "$*" >> '${logPath}'\n`)
        for (const executable of ['dnf', 'systemctl', 'docker', 'usermod']) chmodSync(join(bin, executable), 0o755)

        const cloudInit = vmSetupUserData('fedora-docker', { os: 'fedora-44', services: ['docker'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replaceAll('/etc/yum.repos.d', directory)
            .replace('mktemp /run/hanasand-dnf-install.XXXXXX', `mktemp '${directory}/dnf-install.XXXXXX'`)
            .replace('. /etc/os-release', 'ID=fedora\nVERSION_ID=44')
        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })

        expect(result.status, result.stderr).toBe(0)
        const commands = readFileSync(logPath, 'utf8')
        expect(commands).not.toContain('dnf5-plugins')
        expect(commands).not.toContain('config-manager')
        expect(commands).toContain('dnf install -y --setopt=retries=2 --setopt=timeout=30')
        expect(readFileSync(`${directory}/docker-ce.repo`, 'utf8')).toContain('baseurl=https://download.docker.com/linux/fedora/$releasever/$basearch/stable')
        expect(readFileSync(`${directory}/docker-ce.repo`, 'utf8')).toContain('gpgkey=https://download.docker.com/linux/fedora/gpg')
        expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test.serial('Enterprise Linux setup retries a transient DNF mirror DNS failure', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-dnf-retry-'))
    try {
        const bin = join(directory, 'bin')
        const statusPath = join(directory, 'status')
        const dnfCallsPath = join(directory, 'dnf-calls')
        mkdirSync(bin)
        writeFileSync(join(bin, 'dnf'), [
            '#!/usr/bin/env bash',
            `printf '%s\\n' "$*" >> '${dnfCallsPath}'`,
            'if [[ " $* " == *" install "* ]]; then',
            `  count="$(grep -c '^install ' '${dnfCallsPath}' || true)"`,
            '  if (( count == 1 )); then echo "Curl error (6): Could not resolve host: mirrors.rockylinux.org" >&2; exit 1; fi',
            'fi',
        ].join('\n'))
        writeFileSync(join(bin, 'systemctl'), '#!/usr/bin/env bash\nexit 0\n')
        writeFileSync(join(bin, 'nginx'), '#!/usr/bin/env bash\nexit 0\n')
        for (const executable of ['dnf', 'systemctl', 'nginx']) chmodSync(join(bin, executable), 0o755)

        const cloudInit = vmSetupUserData('rocky-retry', { os: 'rocky-9', services: ['nginx'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('mktemp /run/hanasand-dnf-install.XXXXXX', `mktemp '${directory}/dnf-install.XXXXXX'`)
            .replace('sleep "$((attempt * 2))"', 'sleep 0.01')
        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })

        expect(result.status).toBe(0)
        expect(readFileSync(dnfCallsPath, 'utf8').match(/^install /gm)).toHaveLength(2)
        expect(readFileSync(dnfCallsPath, 'utf8')).toContain('clean metadata')
        expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
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
    expect(script).toContain('grep -Eq \'"(nodejs|minecraft-java)"\'; then apt_packages+=(python3); fi')
    expect(script.indexOf('apt_packages+=(python3)')).toBeLessThan(script.indexOf('apt_install_once()'))
    expect(script).toContain('systemctl enable --now postgresql')
    expect(script).toContain('node --version; npm --version')
    expect(script).toContain('wait_for_ready PostgreSQL pg_isready')
    expect(script.match(/run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 --error-on=any update -qq/g)).toHaveLength(1)
    expect(script.match(/run_bounded 1800 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o DPkg::Lock::Timeout=600 -o Dpkg::Progress-Fd=3 install -y --no-install-recommends "\$\{apt_packages\[@\]\}"/g)).toHaveLength(1)
    expect(script).not.toContain('nodesource.com/setup_24.x')
    execFileSync('bash', ['-n'], { input: script })
})

test('APT-based Node.js and Minecraft plans install Python before their download helpers run', () => {
    for (const [os, service] of [
        ['ubuntu-24.04', 'nodejs'],
        ['debian-13', 'nodejs'],
        ['kali', 'minecraft-java'],
    ] as const) {
        const cloudInit = vmSetupUserData('bootstrap-vm', { os, services: [service] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content || ''
        const pythonPackage = script.indexOf('apt_packages+=(python3)')
        const packageInstall = script.indexOf('apt_install_once()')
        const downloader = script.indexOf(service === 'nodejs' ? 'Installing Node.js 24 LTS' : 'server_type, requested_json = sys.argv[1:]')

        expect(pythonPackage).toBeGreaterThanOrEqual(0)
        expect(packageInstall).toBeGreaterThan(pythonPackage)
        expect(downloader).toBeGreaterThan(packageInstall)
        execFileSync('bash', ['-n'], { input: script })
    }
})

test.serial('Node.js archive download retries an incomplete transfer and verifies the release checksum', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-node-download-'))
    const payload = Buffer.from('bounded fixture for the Node.js archive downloader')
    const digest = await Bun.CryptoHasher.hash('sha256', payload, 'hex')

    try {
        const cloudInit = vmSetupUserData('runtime-vm', { services: ['nodejs'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const setupScript = config.write_files[0]?.content || ''
        const marker = 'run_bounded 300 python3 - <<\'PY\'\n'
        const start = setupScript.indexOf(marker)
        const end = setupScript.indexOf('\ntarget = pathlib.Path("/opt")', start)
        expect(start).toBeGreaterThanOrEqual(0)
        expect(end).toBeGreaterThan(start)
        const fakeTransport = `
import base64
import io
import json
import platform
import urllib.request

platform.machine = lambda: "x86_64"
fixture = base64.b64decode(${JSON.stringify(payload.toString('base64'))})
fixture_checksum = ${JSON.stringify(digest)}
download_requests = 0

class FakeResponse(io.BytesIO):
    def __init__(self, body, headers=None):
        super().__init__(body)
        self.headers = headers or {}
    def __enter__(self): return self
    def __exit__(self, *args): self.close()

def fake_urlopen(url, timeout=0):
    global download_requests
    if url.endswith("index.json"):
        return FakeResponse(json.dumps([{"version":"v24.1.0"}]).encode())
    if url.endswith("SHASUMS256.txt"):
        return FakeResponse((fixture_checksum + "  node-v24.1.0-linux-x64.tar.xz\\n").encode())
    download_requests += 1
    headers = {"Content-Length": str(len(fixture))}
    return FakeResponse(fixture[:len(fixture)//2] if download_requests == 1 else fixture, headers)

urllib.request.urlopen = fake_urlopen
`
        const downloader = setupScript.slice(start + marker.length, end)
            .replace('import urllib.request', `import urllib.request${fakeTransport}`)
            .replace('pathlib.Path("/tmp") / filename', `pathlib.Path(${JSON.stringify(directory)}) / filename`)
            + '\nprint(f"DOWNLOAD_REQUESTS={download_requests};ARCHIVE_SIZE={archive.stat().st_size}")\n'
        const result = await new Promise<{ status: number | null, stdout: string, stderr: string }>((resolve, reject) => {
            const child = spawn('python3', ['-c', downloader])
            let stdout = '', stderr = ''
            child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk })
            child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk })
            child.on('error', reject)
            child.on('close', status => resolve({ status, stdout, stderr }))
        })
        if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Python exited ${result.status}`)
        expect(result.stdout.trim()).toBe(`DOWNLOAD_REQUESTS=2;ARCHIVE_SIZE=${payload.length}`)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
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
            .replaceAll('sleep 2', 'sleep 0.01')
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
                .replaceAll('sleep 2', 'sleep 0.01')
                .replaceAll('sleep 1', 'sleep 0.01')
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
            .replaceAll('sleep 2', 'sleep 0.1')
            .replace('set_stage() { setup_stage=$1; write_state Provisioning "$1"; }', `set_stage() { setup_stage=$1; write_state Provisioning "$1"; printf '%s\\n' "$1" >> '${progressLog}'; }`)

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
        expect(readFileSync(progressLog, 'utf8')).toContain('Installing ripgrep 40%')
        expect(readFileSync(progressLog, 'utf8')).toContain('Installing ripgrep 100%')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('apt status reports elapsed time when package configuration emits no progress events', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-apt-heartbeat-'))
    try {
        const bin = join(directory, 'bin')
        const statusPath = join(directory, 'status')
        const progressLog = join(directory, 'progress.log')
        mkdirSync(bin)
        const fakeAptGet = join(bin, 'apt-get')
        writeFileSync(fakeAptGet, [
            '#!/usr/bin/env bash',
            'if [[ " $* " == *" install "* ]]; then sleep 0.3; fi',
        ].join('\n'))
        chmodSync(fakeAptGet, 0o755)

        const cloudInit = vmSetupUserData('apt-heartbeat-vm', { aptPackages: ['ripgrep'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('mktemp /run/hanasand-apt-progress.XXXXXX', `mktemp '${directory}/apt-progress.XXXXXX'`)
            .replace('apt_last_status=$SECONDS', 'apt_last_status=$((SECONDS - 15))')
            .replace('    sleep 2\n  done\n  update_apt_progress', '    sleep 0.01\n  done\n  update_apt_progress')
            .replace('set_stage() { setup_stage=$1; write_state Provisioning "$1"; }', `set_stage() { setup_stage=$1; write_state Provisioning "$1"; printf '%s\\n' "$1" >> '${progressLog}'; }`)

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
        expect(readFileSync(progressLog, 'utf8')).toContain('Installing selected packages (0m 0s elapsed)')
        expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('APT metadata and package downloads retry transient repository failures and finish setup', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-apt-retry-'))
    try {
        const bin = join(directory, 'bin')
        const statusPath = join(directory, 'status')
        const progressLog = join(directory, 'progress.log')
        const updateCount = join(directory, 'update-count')
        const installCount = join(directory, 'install-count')
        const configureCount = join(directory, 'configure-count')
        mkdirSync(bin)
        const fakeAptGet = join(bin, 'apt-get')
        writeFileSync(fakeAptGet, [
            '#!/usr/bin/env bash',
            'if [[ " $* " == *" update "* ]]; then',
            `  count=$(cat '${updateCount}' 2>/dev/null || printf 0)`,
            '  count=$((count + 1))',
            `  printf '%s' "$count" > '${updateCount}'`,
            '  if (( count == 1 )); then printf "Temporary failure resolving repository\\n" >&2; exit 100; fi',
            '  exit 0',
            'fi',
            `count=$(cat '${installCount}' 2>/dev/null || printf 0)`,
            'count=$((count + 1))',
            `printf '%s' "$count" > '${installCount}'`,
            'if (( count == 1 )); then printf "E: dpkg was interrupted, you must manually run dpkg --configure -a\\n" >&2; exit 100; fi',
            'exit 0',
        ].join('\n'))
        chmodSync(fakeAptGet, 0o755)
        const fakeDpkg = join(bin, 'dpkg')
        writeFileSync(fakeDpkg, `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> '${configureCount}'\nexit 0\n`)
        chmodSync(fakeDpkg, 0o755)

        const cloudInit = vmSetupUserData('apt-retry-vm', { aptPackages: ['ripgrep'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${statusPath}'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('mktemp /run/hanasand-apt-progress.XXXXXX', `mktemp '${directory}/apt-progress.XXXXXX'`)
            .replace('sleep "$((attempt * 3))"', 'sleep 0')
            .replaceAll('sleep 2', 'sleep 0.01')
            .replace('set_stage() { setup_stage=$1; write_state Provisioning "$1"; }', `set_stage() { setup_stage=$1; write_state Provisioning "$1"; printf '%s\\n' "$1" >> '${progressLog}'; }`)

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        if (result.status !== 0) throw new Error(`${result.stderr}\n${result.stdout}`)
        expect(readFileSync(updateCount, 'utf8')).toBe('3')
        expect(readFileSync(installCount, 'utf8')).toBe('2')
        expect(readFileSync(configureCount, 'utf8').trim()).toBe('--configure -a')
        expect(readFileSync(progressLog, 'utf8')).toContain('Recovering interrupted package configuration')
        expect(readFileSync(progressLog, 'utf8')).toContain('Package repository unavailable; retrying metadata refresh (2/4)')
        expect(readFileSync(progressLog, 'utf8')).toContain('Package installation did not complete; refreshing metadata before retrying')
        expect(readFileSync(statusPath, 'utf8').trim()).toBe('Running\tSetup complete')
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('AI-selected Ubuntu packages are installed as package names, never shell commands', () => {
    const cloudInit = vmSetupUserData('custom-vm', { services: [], aptPackages: ['ruby-full', 'ripgrep'] })
    const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
    const script = config.write_files[0]?.content || ''

    expect(script).toContain('apt_packages+=( \'ripgrep\' \'ruby-full\' )')
    expect(script).toContain('run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 --error-on=any update -qq')
    expect(script).toContain('DPkg::Lock::Timeout=600 -o Dpkg::Progress-Fd=3 install -y --no-install-recommends "${apt_packages[@]}"')
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

test('a stalled package install hits its deadline and reports a visible setup error', () => {
    const directory = mkdtempSync(join(tmpdir(), 'vm-setup-timeout-'))
    try {
        const bin = join(directory, 'bin')
        mkdirSync(bin)
        const fakePs = join(bin, 'ps')
        writeFileSync(fakePs, '#!/bin/sh\nprintf "D\\n"\n')
        chmodSync(fakePs, 0o755)
        const cloudInit = vmSetupUserData('hei', { services: ['postgresql'] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content
            .replace('state_file=\'/var/lib/hanasand-vm-setup/status\'', `state_file='${directory}/status'`)
            .replace('install -d -m 0755 /var/lib/hanasand-vm-setup', `install -d -m 0755 '${directory}'`)
            .replace('run_bounded 120 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 --error-on=any update -qq', 'run_bounded 1 sleep 0')
            .replace('run_bounded 900 apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 -o Dpkg::Progress-Fd=3 install -y --no-install-recommends "${apt_packages[@]}" 3>"$apt_progress_file" &', 'run_bounded 1 sleep 3 &')

        const result = spawnSync('bash', ['-c', script || ''], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` } })
        expect(result.status).not.toBe(0)
        const [state, message] = readFileSync(join(directory, 'status'), 'utf8').trim().split('\t')
        expect(state).toBe('Error')
        expect(message).toMatch(/^Service setup failed during Package installation is blocked on storage I\/O\./)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})

test('Java installs a checked Adoptium JDK and Minecraft selects a matching runtime', () => {
    for (const service of ['java', 'minecraft-java'] as const) {
        const cloudInit = vmSetupUserData('runtime-vm', { services: [service] })
        const config = parse(cloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
        const script = config.write_files[0]?.content || ''
        expect(script).toContain(`"${service}"`)
        if (service === 'java') {
            expect(script).toContain('apt_packages+=(ca-certificates python3 tar)')
            expect(script).toContain('java_version=21')
            expect(script).toContain('java_image_type=jdk')
            expect(script).toContain('v3/assets/latest/{java_version}/hotspot?{asset_query}')
            expect(script).not.toContain('default-jdk-headless')
            const rocky = vmSetupUserData('rocky-java', { os: 'rocky-9', services: ['java'] })
            const rockyConfig = parse(rocky.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }
            expect(rockyConfig.write_files[0]?.content).toContain('packages+=(python3)')
            expect(rockyConfig.write_files[0]?.content).toContain('packages+=(tar)')
            expect(rockyConfig.write_files[0]?.content).not.toContain('java-21-openjdk-devel')
        } else {
            expect(script).toContain('java_version=17')
            expect(script).toContain('if [[ "$mc_game_version" == 26.* ]]; then java_version=25')
            expect(script).toContain('then java_version=21')
            expect(script.indexOf('Matching Minecraft server and add-ons to a supported version')).toBeLessThan(script.indexOf('set_stage "Installing Java $java_version"'))
            const javaBlockStart = script.indexOf('    java_version=17')
            const javaBlockEnd = script.indexOf('\n    java_image_type=jre', javaBlockStart)
            const javaBlock = script.slice(javaBlockStart, javaBlockEnd)
            for (const [version, expected] of [['1.19.4', '17'], ['1.20.4', '17'], ['1.20.6', '21'], ['1.21.1', '21'], ['26.1.2', '25']]) {
                const result = spawnSync('bash', ['-c', `${javaBlock}\nprintf '%s' "$java_version"`], { encoding: 'utf8', env: { ...process.env, mc_game_version: version } })
                expect(result.status).toBe(0)
                expect(result.stdout).toBe(expected)
            }
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
    expect(script).toContain('directory, loader, requested_json, game_version = sys.argv[1:]')
    expect(script).not.toContain('game_version = sys.argv[4]')
    expect(script).toContain('fabric-api')
    expect(script).toContain('qsl')
    expect(script).toContain('ThreadPoolExecutor')
    expect(script).toContain('game_versions')
    expect(script).toContain('deadline = time.monotonic() + 75')
    expect(script).toContain('timeout=min(8, remaining)')
    expect(script).not.toContain('while offset < 2000')
    const resolver = script.match(/mc_game_version="\$\((?:timeout --signal=TERM --kill-after=2s 75s )?python3 - '[^']+' '[^']+' <<'PY'\n([\s\S]*?)\nPY\n\)"/)?.[1]
    expect(resolver).toBeTruthy()
    const pythonCheck = spawnSync('python3', ['-c', 'import sys; compile(sys.stdin.read(), "generated-minecraft-resolver", "exec")'], { input: resolver, encoding: 'utf8' })
    expect(pythonCheck.status).toBe(0)
    const resolverExercise = `
import contextlib, io, json, sys, urllib.parse, urllib.request
class Response(io.BytesIO):
    def __enter__(self): return self
    def __exit__(self, *args): self.close()
calls = []
def fake_urlopen(request, timeout=0):
    url = request.full_url if hasattr(request, 'full_url') else request
    if 'version_manifest_v2.json' in url:
        body = {'versions': [{'id': '1.21.11', 'type': 'release'}, {'id': '1.21.10', 'type': 'release'}]}
    elif '/v3/projects/paper' in url:
        body = {'versions': {'1.21': ['1.21.11', '1.21.10']}}
    elif '/project/' in url:
        params = dict(urllib.parse.parse_qsl(urllib.parse.urlsplit(url).query))
        candidates = json.loads(params['game_versions'])
        calls.append(candidates)
        body = [{'version_type': 'release', 'files': [{'url': 'https://example.test/mod.jar'}], 'game_versions': ['1.21.10']}]
    else:
        raise AssertionError('Unexpected metadata URL: ' + url)
    return Response(json.dumps(body).encode())
urllib.request.urlopen = fake_urlopen
namespace = {'__name__': '__main__'}
sys.argv = ['resolver', 'PAPER', '["essentialsx", "luckperms"]']
output = io.StringIO()
try:
    with contextlib.redirect_stdout(output): exec(compile(${JSON.stringify(resolver)}, 'resolver', 'exec'), namespace)
except SystemExit as exit_value:
    assert exit_value.code == 0, exit_value.code
assert output.getvalue().strip() == '1.21.10', output.getvalue()
assert len(calls) == 2, calls
print('RESOLVER_COMPATIBLE_VERSION=' + output.getvalue().strip())
`
    const resolverResult = spawnSync('python3', ['-c', resolverExercise], { encoding: 'utf8' })
    expect(resolverResult.status).toBe(0)
    expect(resolverResult.stdout.trim()).toBe('RESOLVER_COMPATIBLE_VERSION=1.21.10')
    execFileSync('bash', ['-n'], { input: script })

    const foliaCloudInit = vmSetupUserData('game-vm', {
        services: ['minecraft-java'], minecraftServerType: 'FOLIA', minecraftEulaAccepted: true,
        minecraftAddons: ['viaversion', 'viabackwards', 'chunky'],
    })
    const foliaScript = (parse(foliaCloudInit.slice('#cloud-config\n'.length)) as { write_files: Array<{ content: string }> }).write_files[0]?.content || ''
    expect(foliaScript).toContain('folia')
    expect(foliaScript).toContain('/opt/minecraft/plugins')
    expect(foliaScript).toContain('viabackwards')
    execFileSync('bash', ['-n'], { input: foliaScript })
})
