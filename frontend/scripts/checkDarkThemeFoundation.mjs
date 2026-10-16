import { readFileSync } from 'node:fs'
import { paletteNames } from './darkThemeTokens.mjs'
import path from 'node:path'
import { collectFiles } from './darkThemeFiles.mjs'

export function checkDarkThemeFoundation(sources, violations, frontendRoot) {
    const { publicTi, workbench, globals } = sources
    const roots = [path.join(frontendRoot, 'src/app/ti'), path.join(frontendRoot, 'src/app/dashboard/ti')]
    const lightSemanticSurface = /(bg-\[#(?:fff4d6|fff1f0|fffdf2|eef3ff|e9f8ef|f4fbf7)\])/
    const semanticText = /text-\[#(?:3056d3|147a3b|8a5a00|b42318|9db4ff|8ca7ff|b8c8ff)\]/
    const hoverOnly = /hover:(?:bg|text)-/
    for (const root of roots) {
        for (const file of collectFiles(root)) {
            const relative = path.relative(frontendRoot, file)
            const lines = readFileSync(file, 'utf8').split(/\r?\n/)
            lines.forEach((line, index) => {
                if (hoverOnly.test(line)) return
                if (lightSemanticSurface.test(line) && semanticText.test(line) && !line.includes('dark:bg')) {
                    violations.push(`${relative}:${index + 1} light semantic badge needs dark:bg and dark:text: ${line.trim()}`)
                }
            })
        }
    }

    const publicTiSyncingTone = 'border border-ui-warning/35 bg-ui-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-ui-warning dark:border-ui-warning/35 dark:bg-ui-warning/10 dark:text-ui-warning'
    const workbenchSyncingTone = 'if (status === \'blocked\') return \'rounded-full bg-ui-warning/10 px-2 py-0.5 text-[11px] font-semibold text-ui-warning \''

    if (!publicTi.includes(publicTiSyncingTone)) {
        violations.push('src/app/ti/pageClient.tsx decisionStepStatusClass fallback must render syncing/review states as amber, not red failure')
    }

    if (!workbench.includes(workbenchSyncingTone)) {
        violations.push('src/app/dashboard/ti/workbench/workbenchClient.tsx workflowStatusClass blocked tone must render as amber syncing, not red failure')
    }

    for (const name of paletteNames) {
        if (!globals.includes(`--color-${name}: var(--${name});`)) {
            violations.push(`globals.css is missing Tailwind palette token --color-${name}`)
        }
        if (!globals.includes(`--${name}: #`)) {
            violations.push(`globals.css is missing concrete palette value --${name}`)
        }
    }
}
