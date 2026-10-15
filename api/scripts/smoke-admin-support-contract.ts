import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const apiDirectory = fileURLToPath(new URL('..', import.meta.url))
const suites = [
    'admin-support-executor-controls',
    'admin-support-input',
    'admin-support-inspection-packets',
    'admin-support-routes',
    'admin-support-subject-inspection',
    'audit-pagination',
].join(',')

const result = spawnSync(process.execPath, [resolve(apiDirectory, 'scripts/index.ts'), `--only=${suites}`], {
    cwd: apiDirectory,
    stdio: 'inherit',
})

if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)

console.log('Admin support runtime behavior checks passed.')
