import { execFileSync } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(frontendRoot, '..')
const limit = 200
const includedExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.toml', '.yaml', '.yml',
])
const excludedDirectories = new Set(['node_modules', '.next', 'coverage', 'playwright-report', 'test-results', 'dist', 'build'])
const generatedFiles = new Set(['src/utils/routes/generatedSearchRoutes.ts'])

const changedOnly = process.argv.includes('--changed')
const files = changedOnly ? changedFiles() : await allFiles(frontendRoot)
const oversized = []

for (const file of files) {
    const relativePath = path.relative(frontendRoot, file).split(path.sep).join('/')
    if (!includedExtensions.has(path.extname(file)) || generatedFiles.has(relativePath)) continue
    const source = await readFile(file, 'utf8')
    const lineCount = source ? source.split(/\r\n|\n|\r/).length - (/(\r\n|\n|\r)$/.test(source) ? 1 : 0) : 0
    if (lineCount > limit) oversized.push({ file: relativePath, lineCount })
}

if (oversized.length) {
    for (const file of oversized) console.error(`${file.lineCount} lines (limit ${limit}): ${file.file}`)
    console.error(`${oversized.length} frontend files exceed the ${limit}-line cap.`)
    process.exitCode = 1
} else {
    console.log(`Line cap passed for ${files.length} ${changedOnly ? 'changed' : 'frontend'} files.`)
}

function changedFiles() {
    const tracked = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMRT', 'HEAD', '--', 'frontend'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
    }).split(/\r?\n/).filter(Boolean)
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', 'frontend'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
    }).split(/\r?\n/).filter(Boolean)
    return [...new Set([...tracked, ...untracked])].map(file => path.join(repositoryRoot, file))
}

async function allFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        const file = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            if (!excludedDirectories.has(entry.name)) files.push(...await allFiles(file))
        } else if (entry.isFile()) {
            files.push(file)
        }
    }
    return files
}
