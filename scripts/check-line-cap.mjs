import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const limit = 200
const extensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.svg', '.json', '.toml',
    '.yaml', '.yml', '.sh', '.vcl', '.sql', '.graphql', '.gql', '.prisma',
    '.proto', '.xml', '.ini', '.conf', '.properties', '.py', '.service',
    '.timer', '.rules', '.example',
])
const names = new Set([
    'Dockerfile', '.dockerignore', 'Dockerfile.dockerignore',
    'CodeInventory.Dockerfile', 'CodeInventory.Dockerfile.dockerignore',
    '.gitignore', '.gitattributes', '.editorconfig', 'Makefile',
])
const excludedDirectories = new Set([
    '.git', 'node_modules', '.next', 'coverage', 'playwright-report',
    'test-results', 'dist', 'build', 'vendor',
])
const generatedFiles = new Set([
    'api/public/openapi.json',
    'api/generated/publicTiApi.d.ts',
    'frontend/src/utils/articles/staticArticles.json',
    'frontend/src/utils/routes/generatedSearchRoutes.ts',
])
const files = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
}).split(/\r?\n/).filter(Boolean)
const oversized = []
const missing = []
let checked = 0
let totalLines = 0

for (const relative of files) {
    const file = path.join(root, relative)
    if (!isInScope(relative) || generatedFiles.has(relative)) continue
    if (!existsSync(file)) {
        missing.push(relative)
        continue
    }
    const source = await readFile(file, 'utf8')
    const lineCount = countLines(source)
    checked++
    totalLines += lineCount
    if (lineCount > limit) oversized.push({ relative, lineCount })
}

if (oversized.length) {
    for (const item of oversized.sort((left, right) => right.lineCount - left.lineCount)) {
        console.error(`${item.lineCount} lines (limit ${limit}): ${item.relative}`)
    }
    console.error(`${oversized.length} of ${checked} files (${totalLines} lines total) exceed the cap.`)
    process.exitCode = 1
} else {
    console.log(`Line cap passed for all ${checked} files (${totalLines} lines total).`)
}
if (missing.length) console.log(`Skipped ${missing.length} tracked paths absent from the working tree.`)

function isInScope(relative) {
    const parts = relative.split('/')
    if (parts.some(part => excludedDirectories.has(part)) || relative.startsWith('ops/monitoring-state/')) return false
    const base = path.basename(relative)
    return extensions.has(path.extname(base)) || names.has(base)
}

function countLines(source) {
    return source ? source.split(/\r\n|\n|\r/).length - (/(\r\n|\n|\r)$/.test(source) ? 1 : 0) : 0
}
