import type { EventProtectionPolicy } from '#utils/events/eventProtection.ts'
import type { Condition } from '#utils/events/conditions.ts'
import type run from '#db'

type Event = Record<string, unknown>
type EventBody = { source?: Record<string, unknown>, events?: unknown }
type RuleDefinition = { match: 'all', conditions: Condition[], storeScope?: 'custom_drop' | 'all', protection?: EventProtectionPolicy, failureConditions?: Condition[], parameters?: Record<string, number>, stage?: 'analyze' | 'match' | 'detect', action?: 'drop' | 'keep' }
type Rule = { id: string, detectionLogic?: string, recordId?: string, version: string, name: string, family: string, severity: string, explanation: string, evidence: string[], enabled?: boolean, source?: 'hanasand' | 'owned' | 'open_source', sourceReference?: string, definition?: RuleDefinition }
type FindingInput = [organizationId: string, ruleId: string, severity: string, summary: string, eventIds: string[], evidence: Event]
type NormalizedEvent = {
    timestamp: string
    eventType: string
    action: string
    outcome: string
    userId: string | null
    userEmail: string | null
    sourceIp: string | null
    sourceCountry: string | null
    sourceCity: string | null
    deviceId: string | null
    sourceVendor: string
    sourceProduct: string
    parserVersion: string
    normalized: Event
    original: Event
}
type ReadAwareRun = typeof run & { withReadDatabase?: <T>(work: () => Promise<T>) => Promise<T> }

export type { Event, EventBody, RuleDefinition, Rule, FindingInput, NormalizedEvent, ReadAwareRun }
