import { readFileSync, readdirSync } from 'node:fs'

const pageClientModules = [
    'pageClientShared.ts', 'pageModel.ts', 'pageConstants.ts', 'pageEffects.ts',
    'actorReferences.ts', 'secondaryViews.ts',
    'freshnessReviewPayload.ts', 'provenanceArtifactPayload.ts', 'actorEvidencePayloads.ts',
    'analystWorkItems.ts', 'relatedRecordPayloads.ts', 'consumerReadiness.ts',
    'sourcePresentation.ts', 'sourceCollectionPayloads.ts', 'caseReviewPresentation.ts',
    'queryPresentation.ts', 'pageMeta.ts',
]
const modelFiles = [
    ...readdirSync(new URL('../../src/app/ti/model/', import.meta.url)).filter(file => file.endsWith('.ts')),
    ...readdirSync(new URL('../../src/app/ti/model/types/', import.meta.url)).filter(file => file.endsWith('.ts')).map(file => `types/${file}`),
]
const componentFiles = readdirSync(new URL('../../src/app/ti/components/', import.meta.url))
    .filter(file => file.endsWith('.tsx'))

export const pageClientSource = [
    ...pageClientModules.map(file => readFileSync(new URL(`../../src/app/ti/${file}`, import.meta.url), 'utf8')),
    ...modelFiles.map(file => readFileSync(new URL(`../../src/app/ti/model/${file}`, import.meta.url), 'utf8')),
    ...componentFiles.map(file => readFileSync(new URL(`../../src/app/ti/components/${file}`, import.meta.url), 'utf8')),
].join('\n')
export const consumerReadinessSource = readFileSync(new URL('../../src/app/ti/consumerReadiness.ts', import.meta.url), 'utf8')
export const evidenceResultsSource = readFileSync(new URL('../../src/app/ti/components/evidence-results.tsx', import.meta.url), 'utf8')
export const globalStylesSource = readFileSync(new URL('../../src/app/global-styles/global-overrides.css', import.meta.url), 'utf8')
export const actorIntelligenceSource = readFileSync(new URL('../../src/utils/ti/actorIntelligence.ts', import.meta.url), 'utf8')
export const actionabilitySource = [
    readFileSync(new URL('../../src/utils/ti/actionability.ts', import.meta.url), 'utf8'),
    ...readdirSync(new URL('../../src/utils/ti/actionability/', import.meta.url))
        .filter(file => file.endsWith('.ts'))
        .map(file => readFileSync(new URL(`../../src/utils/ti/actionability/${file}`, import.meta.url), 'utf8')),
    ...readdirSync(new URL('../../src/utils/ti/actionability/types/', import.meta.url))
        .filter(file => file.endsWith('.ts'))
        .map(file => readFileSync(new URL(`../../src/utils/ti/actionability/types/${file}`, import.meta.url), 'utf8')),
].join('\n')
export const actorProfileSource = readFileSync(new URL('../../src/utils/ti/actorProfile.ts', import.meta.url), 'utf8')
export const actorWorkbenchSource = readFileSync(new URL('../../src/utils/ti/actorWorkbench.ts', import.meta.url), 'utf8')
export const dashboardWorkbenchPageSource = readFileSync(new URL('../../src/app/dashboard/ti/workbench/page.tsx', import.meta.url), 'utf8')
export const publicTiHandoffSource = readFileSync(new URL('../../src/app/dashboard/publicTiHandoff.ts', import.meta.url), 'utf8')
export const apiSearchSource = readFileSync(new URL('../../../api/src/utils/ti/search.ts', import.meta.url), 'utf8')
export const bannedUiCopy = [
    'how this feeds',
    'control room',
    'target signal',
    'signal language',
    'named examples',
    'authenticated bridge',
    'copy handoff payloads',
    'geography to action',
    'provenance to action',
    'related backed objects',
    'backed objects',
    'contract',
    'acceptance criteria',
    'dashboard slop',
    'api result data is live',
    'case payload',
    'mode live',
    'open dwm workbench',
    'api work',
    'console/api workflow',
]
export const brightDarkSurfaceTokens = [
    'border-white/10',
    'bg-white/10',
    'dark:border-white',
    'dark:bg-white',
]
export const publicTiImplementationPhrases = [
    'API activity result',
    'TI search API',
    'search API',
    'actionability contract',
    'built-in actor enrichment fallback',
    'watchlistMatches',
    'actorIntelligence.malwareTools',
]
export const backendResultVerb = ['return', 'ed'].join('')
export const publicTiBackendEmptyStatePatterns = [
    new RegExp(`What\\s+${backendResultVerb}`, 'i'),
    new RegExp(`\\b${backendResultVerb} observations\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} actor profile\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} as evidence\\b`, 'i'),
    new RegExp(`\\bNo\\s+[A-Za-z][A-Za-z /-]{0,80}\\s+${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bwas\\s+${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bnot\\s+${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bnone\\s+${backendResultVerb}\\b`, 'i'),
    /\bexpanded for review\b/i,
    new RegExp(`\\b${backendResultVerb} profile\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} by\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} for\\b`, 'i'),
    new RegExp(`\\bsource result[^.]*${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\bSource actions ${backendResultVerb}\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} source\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} current\\b`, 'i'),
    new RegExp(`\\b${backendResultVerb} sources\\b`, 'i'),
    new RegExp(`\\bOpen the ${backendResultVerb} source\\b`, 'i'),
]
