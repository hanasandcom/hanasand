import {
    getDatabaseRunNotice,
    getPostgresFilterPortError,
    isTaskEnabledByDefault,
} from './test-runner-policy.ts'
import { runTask } from './test-runner-execution.ts'
import { discoverTestTasks, parseSelectedTaskIds } from './test-runner-tasks.ts'

const tasks = await discoverTestTasks()
const selected = parseSelectedTaskIds(process.argv.slice(2))
const runnable = tasks.filter(task => selected.size
    ? selected.has(task.id)
    : isTaskEnabledByDefault(task.requires, process.env))

if (!runnable.length) {
    throw new Error(`No API test tasks selected. Known tasks: ${tasks.map(task => task.id).join(', ')}`)
}

if (!selected.size) {
    const notice = getDatabaseRunNotice(tasks, process.env.RUN_DB_TESTS === '1')
    if (notice) console.info(`\n[api:test] ${notice}`)
}

const filterPortError = getPostgresFilterPortError(runnable, process.env.POSTGRES_FILTER_TEST_PORT)
if (filterPortError) throw new Error(filterPortError)

for (const task of runnable) await runTask(task)
