import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

export function readDashboardRenderSource() {
    const directory = path.join(import.meta.dirname, 'dashboardRender')
    const files = ['check-dashboard-render-dom.mjs', ...readdirSync(directory).filter(file => file.endsWith('.mjs')).map(file => path.join('dashboardRender', file))]
    return files.map(file => readFileSync(path.join(import.meta.dirname, file), 'utf8')).join('\n')
}
