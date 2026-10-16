import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadThemeSources } from './darkThemeSources.mjs'
import { checkDarkThemeFoundation } from './checkDarkThemeFoundation.mjs'
import { checkDarkThemeCorePages } from './checkDarkThemeCorePages.mjs'
import { checkDarkThemeDashboardPages } from './checkDarkThemeDashboardPages.mjs'
import { checkDarkThemeShareComponents } from './checkDarkThemeShareComponents.mjs'
import { checkDarkThemeProductRoutes } from './checkDarkThemeProductRoutes.mjs'
import { checkDarkThemePublicRoutes } from './checkDarkThemePublicRoutes.mjs'
import { checkDarkThemeContrast } from './darkThemeContrast.mjs'

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sources = loadThemeSources(frontendRoot)
const violations = []

checkDarkThemeFoundation(sources, violations, frontendRoot)
checkDarkThemeCorePages(sources, violations)
checkDarkThemeDashboardPages(sources, violations)
checkDarkThemeShareComponents(sources, violations)
checkDarkThemeProductRoutes(sources, violations)
checkDarkThemePublicRoutes(sources, violations)
checkDarkThemeContrast(sources, violations)

if (violations.length) {
    console.error('[dark-theme-contrast] light semantic badges need dark-mode surfaces')
    console.error(violations.join('\n'))
    process.exit(1)
}

console.log('[dark-theme-contrast] semantic badges include dark-mode surfaces')
