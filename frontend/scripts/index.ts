import { contractTasks } from './contractTasks'
import { authOrganizationTasks } from './authOrganizationTasks'
import { dwmProductProgressTasks } from './dwmProductProgressTasks'
import { e2eTasks } from './e2eTasks'
import { otherUnitTasks } from './otherUnitTasks'
import { productTasks } from './productTasks'
import { tiTasks } from './tiTasks'
import { runTestTask } from './runTestTask'
import { parseOnly, shouldRunByDefault } from './taskSelection'

const tasks = [
    ...productTasks,
    ...contractTasks,
    ...authOrganizationTasks,
    ...dwmProductProgressTasks,
    ...tiTasks,
    ...otherUnitTasks,
    ...e2eTasks,
]
const selected = parseOnly(process.argv.slice(2))
const includeServer = process.env.RUN_SERVER_TESTS === '1'
const includePlaywright = process.env.RUN_E2E === '1' || process.env.RUN_PLAYWRIGHT === '1'
const runnable = tasks.filter(task => selected.size ? selected.has(task.id) : shouldRunByDefault(task, includeServer, includePlaywright))

if (!runnable.length) {
    throw new Error(`No frontend test tasks selected. Known tasks: ${tasks.map(task => task.id).join(', ')}`)
}

for (const task of runnable) {
    if (task.requires === 'server' && !includeServer && !selected.has(task.id)) continue
    if (task.requires === 'playwright' && !includePlaywright && !selected.has(task.id)) continue
    await runTestTask(task)
}
