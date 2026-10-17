import type { SessionState } from './sessionState.ts'
import { documentDeobfuscationTasks } from './networkEvidence.ts'
import { extractIndicators, extractThreatAssociations } from './analysis.ts'
import { collectPageEvidence } from './pageEvidence.ts'
import type { SandboxDeobfuscationTask } from './providerTypes.ts'
import type { SandboxToolAnalysis } from './providerTypes.ts'

type DocumentEvidenceDependencies = {
    state: SessionState
    isCurrentRun: (generation: number) => boolean
    maybeExtendSuspiciousRun: (evidence?: { verdict?: string } | null, analysis?: SandboxToolAnalysis | null, generation?: number) => void
}

export function createDocumentEvidenceService({ state, isCurrentRun, maybeExtendSuspiciousRun }: DocumentEvidenceDependencies) {
    function rememberDeobfuscationTasks(evidence: { deobfuscationTasks?: SandboxDeobfuscationTask[] } | null) {
        if (evidence?.deobfuscationTasks?.length) state.cachedDeobfuscationTasks = evidence.deobfuscationTasks
    }

    function rememberDocumentEvidence(html: string) {
        rememberDeobfuscationTasks({ deobfuscationTasks: documentDeobfuscationTasks(html) })
        const renderedText = html.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')
        state.cachedIndicators = extractIndicators(`${html}\n${renderedText}`)
        const associations = extractThreatAssociations(renderedText, 'rendered_page')
        if (associations.length) state.cachedThreatAssociations = associations
    }

    function queueDocumentEvidence(body: Promise<string>, generation: number) {
        if (!isCurrentRun(generation)) return Promise.resolve()
        const pending = body.then(html => {
            if (isCurrentRun(generation)) rememberDocumentEvidence(html)
        }).catch(() => undefined)
        state.documentEvidencePromises.push(pending)
        void pending.finally(() => {
            if (isCurrentRun(generation)) state.documentEvidencePromises = state.documentEvidencePromises.filter(item => item !== pending)
        })
        return pending
    }

    async function webCrackTasks(tasks: SandboxDeobfuscationTask[], generation = state.runGeneration) {
        const deadline = Date.now() + 1200
        while (isCurrentRun(generation) && !tasks.length && !state.cachedDeobfuscationTasks.length && Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 100))
        }
        if (!isCurrentRun(generation)) return []
        if (!tasks.length && !state.cachedDeobfuscationTasks.length && state.page && !state.page.isClosed()) {
            const liveEvidence = await collectPageEvidence(state.page).catch(() => null)
            if (!isCurrentRun(generation)) return []
            rememberDeobfuscationTasks(liveEvidence)
            maybeExtendSuspiciousRun(liveEvidence, null, generation)
        }
        return tasks.length ? tasks : state.cachedDeobfuscationTasks
    }
    return { rememberDeobfuscationTasks, rememberDocumentEvidence, queueDocumentEvidence, webCrackTasks }
}
