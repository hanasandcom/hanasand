import { exactCaseSensitiveMessage, exactMessageIndexMaxBytes, hasPostgresRegexCandidate, messageCandidatePredicate, processExecutableCandidatePredicate } from './previewPredicate.ts'
import type { Condition } from './conditions.ts'

const eventCandidateColumns: Record<string, string> = {
    source_vendor: 'source_vendor', source_product: 'source_product', event_type: 'event_type', service: 'normalized->>\'service\'',
    action: 'action', outcome: 'outcome', user_id: 'user_id', source_ip: 'source_ip',
}

function eventFieldCandidatePredicate(conditions: Condition[], bind: (value: string) => string, includeExecutable = true) {
    const scalar = conditions.flatMap(condition => {
        const column = eventCandidateColumns[condition.path]
        if (!column || condition.operator !== 'equals' || condition.path === 'service' && !condition.caseSensitive) return []
        const value = bind(condition.value)
        return [condition.caseSensitive ? `${column} = ${value}` : `lower(${column}) = lower(${value})`]
    })
    const executable = includeExecutable ? processExecutableCandidatePredicate(conditions, bind) : null
    return [...scalar, executable].filter((predicate): predicate is string => Boolean(predicate)).join(' AND ')
}

export function usesTimeOrderedMessageScan(conditions: Condition[]) {
    return conditions.some(condition => condition.path === 'message' && condition.caseSensitive
        && hasPostgresRegexCandidate(condition) && /^\^[A-Za-z0-9 _:/@,=-]{5,}/.test(condition.value))
        && conditions.some(condition => condition.path === 'event_type' && condition.operator === 'equals' && condition.caseSensitive)
        && conditions.some(condition => condition.path === 'service' && condition.operator === 'equals' && condition.caseSensitive)
}

export function reprocessCandidatePredicate(conditions: Condition[], bind: (value: string) => string, useTrigram: boolean) {
    const exactMessage = exactCaseSensitiveMessage(conditions)
    if (exactMessage) {
        return [
            eventFieldCandidatePredicate(conditions, bind, false),
            `normalized->>'message' = ${bind(exactMessage.value)} AND octet_length(normalized->>'message') <= ${exactMessageIndexMaxBytes}`,
        ].filter(Boolean).join(' AND ')
    }
    return [
        eventFieldCandidatePredicate(conditions, bind),
        // The caller disables trigram scans for anchored command patterns with
        // exact process/service fields, avoiding a broad bitmap and page sort.
        messageCandidatePredicate(conditions, 'normalized->>\'message\'', bind, { useTrigram }),
    ].filter(Boolean).join(' AND ') || 'TRUE'
}
