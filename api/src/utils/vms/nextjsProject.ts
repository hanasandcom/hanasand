export type NextjsProjectFile = { path: string; content: string }

const maxProjectFiles = 96
const maxProjectBytes = 120 * 1024
const maxProjectFileBytes = 48 * 1024
const projectPathPattern = /^[A-Za-z0-9_.@/-]+$/
const generatedAppPathPattern = /^(?:src\/app|src\/lib|public)\/[A-Za-z0-9_.@/-]+\.(?:js|jsx|css|json)$/

export function normalizeNextjsProjectFiles(value: unknown): NextjsProjectFile[] | null {
    if (!Array.isArray(value) || value.length === 0 || value.length > maxProjectFiles) return null

    const files: NextjsProjectFile[] = []
    const paths = new Set<string>()
    let totalBytes = 0
    for (const item of value) {
        if (!item || typeof item !== 'object') return null
        const file = item as Record<string, unknown>
        if (typeof file.path !== 'string' || typeof file.content !== 'string') return null
        const path = file.path
        if (!path || path.length > 180 || !projectPathPattern.test(path)
            || path.startsWith('/') || path.includes('\\')
            || path.split('/').some(part => !part || part === '.' || part === '..')
            || path.split('/').some(part => part.toLowerCase() === '.env' || part.toLowerCase().startsWith('.env.'))
            || path.split('/').some(part => ['node_modules', '.next', '.git'].includes(part.toLowerCase()))) return null
        if (paths.has(path)) return null

        const bytes = Buffer.byteLength(file.content, 'utf8')
        if (bytes > maxProjectFileBytes) return null
        totalBytes += bytes
        if (totalBytes > maxProjectBytes) return null
        paths.add(path)
        files.push({ path, content: file.content })
    }

    const packageFile = files.find(file => file.path === 'package.json')
    if (!packageFile) return null
    let packageJson: Record<string, unknown>
    try {
        packageJson = JSON.parse(packageFile.content) as Record<string, unknown>
    } catch {
        return null
    }
    const scripts = packageJson.scripts && typeof packageJson.scripts === 'object'
        ? packageJson.scripts as Record<string, unknown>
        : {}
    const dependencies = { ...asRecord(packageJson.dependencies), ...asRecord(packageJson.devDependencies) }
    if (!Object.hasOwn(dependencies, 'next') || !Object.hasOwn(dependencies, 'react') || !Object.hasOwn(dependencies, 'react-dom') || scripts.build !== 'next build'
        || scripts.start !== 'next start --hostname 0.0.0.0 --port 3000'
        || Object.hasOwn(scripts, 'prebuild') || Object.hasOwn(scripts, 'postbuild')
        || Object.hasOwn(scripts, 'prestart') || Object.hasOwn(scripts, 'poststart')) return null

    return files
}

export function normalizeGeneratedNextjsProjectFiles(value: unknown): NextjsProjectFile[] | null {
    if (!Array.isArray(value) || value.some(item => !item || typeof item !== 'object'
        || typeof (item as Record<string, unknown>).path !== 'string'
        || !generatedAppPathPattern.test((item as Record<string, unknown>).path as string))) return null

    const paths = new Set(value.map(item => (item as Record<string, string>).path))
    if (paths.has('package.json') || !paths.has('src/app/page.jsx') || !paths.has('src/app/layout.jsx')) return null

    const packageJson = JSON.stringify({
        name: 'hanasand-generated-app',
        version: '1.0.0',
        private: true,
        scripts: {
            build: 'next build',
            start: 'next start --hostname 0.0.0.0 --port 3000',
        },
        dependencies: {
            next: '16.2.4',
            react: '19.2.5',
            'react-dom': '19.2.5',
        },
    })
    const normalized = normalizeNextjsProjectFiles([...value, { path: 'package.json', content: packageJson }])
    if (!normalized) return null
    return normalized
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
