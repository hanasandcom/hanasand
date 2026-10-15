import crypto from 'node:crypto'
import { canonicalJson, containsUnsafeCustomerOutboundText } from './customerOutputSafety.ts'

const MAX_THIRD_PARTY_REPORT_BYTES = 256_000
const MAX_THIRD_PARTY_REPORT_EVIDENCE = 25

export function validateOutboundThirdPartyReport(value: unknown, binding: {
    organizationId?: unknown
    alertId?: unknown
    dedupeKey?: unknown
} = {}): {
    valid: boolean
    error?: string
    report?: Record<string, unknown>
} {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { valid: false, error: 'report must be an object.' }
    const report = value as Record<string, unknown>
    let encoded: string
    try {
        const serialized = canonicalJson(report)
        if (typeof serialized !== 'string') return { valid: false, error: 'report must be JSON serializable.' }
        encoded = serialized
    } catch {
        return { valid: false, error: 'report must be JSON serializable.' }
    }
    if (Buffer.byteLength(encoded, 'utf8') > MAX_THIRD_PARTY_REPORT_BYTES) return { valid: false, error: 'report exceeds the 256000-byte delivery limit.' }
    if (containsUnsafeReportField(report)) return { valid: false, error: 'report contains raw content, a source locator, or another unsafe field.' }
    if (containsUnsafeCustomerOutboundText(report)) return { valid: false, error: 'report contains a restricted locator, contact, or credential.' }

    const policy = recordOrEmpty(report.reportPolicy)
    const format = clean(policy.format)
    const evidenceIds = cleanList(policy.evidenceIds)
    const evidenceCount = Number(policy.evidenceCount)
    const exportChecksum = clean(report.exportChecksum)
    if (clean(policy.direction) !== 'outbound_third_party') return { valid: false, error: 'reportPolicy.direction must be outbound_third_party.' }
    if (format !== 'stix-2.1' && format !== 'hanasand-json') return { valid: false, error: 'reportPolicy.format must be stix-2.1 or hanasand-json.' }
    if (!clean(policy.caseId) || !clean(policy.alertId) || !exportChecksum) return { valid: false, error: 'report caseId, alertId, and exportChecksum are required.' }
    if (clean(policy.exportChecksum) !== exportChecksum || computeOutboundThirdPartyReportChecksum(report) !== exportChecksum) {
        return { valid: false, error: 'report checksum does not match the canonical bounded report content.' }
    }
    if (binding.organizationId !== undefined && clean(binding.organizationId) !== clean(policy.organizationId)) {
        return { valid: false, error: 'report organization does not match delivery scope.' }
    }
    if (binding.alertId !== undefined && clean(binding.alertId) !== clean(policy.alertId)) {
        return { valid: false, error: 'report alertId does not match the delivered alert.' }
    }
    if (binding.dedupeKey !== undefined && clean(binding.dedupeKey) !== clean(report.exportChecksum)) {
        return { valid: false, error: 'report delivery dedupeKey must equal exportChecksum.' }
    }
    if (!Number.isInteger(evidenceCount) || evidenceCount < 1 || evidenceCount > MAX_THIRD_PARTY_REPORT_EVIDENCE) {
        return { valid: false, error: 'report evidenceCount must be between 1 and 25.' }
    }
    if (evidenceIds.length !== evidenceCount || new Set(evidenceIds).size !== evidenceIds.length) {
        return { valid: false, error: 'report evidenceIds must be unique and match evidenceCount.' }
    }
    if (evidenceIds.some((id, index) => index > 0 && evidenceIds[index - 1] > id)) {
        return { valid: false, error: 'report evidenceIds must use canonical order.' }
    }

    if (format === 'stix-2.1') {
        const validation = recordOrEmpty(report.standardsValidation)
        const bundle = recordOrEmpty(report.bundle)
        const objects = Array.isArray(bundle.objects) ? bundle.objects : []
        const evidenceObjects = objects.filter(item => recordOrEmpty(item).type === 'x-ti-evidence')
        const reports = objects.filter(item => recordOrEmpty(item).type === 'report')
        const identities = objects.filter(item => recordOrEmpty(item).type === 'identity')
        if (validation.valid !== true || clean(validation.standard) !== 'STIX 2.1') return { valid: false, error: 'STIX standards validation proof is required.' }
        if (bundle.type !== 'bundle' || !/^bundle--[0-9a-f-]{36}$/.test(clean(bundle.id)) || objects.length !== evidenceCount + 2) return { valid: false, error: 'STIX bundle is missing or does not match the bounded object count.' }
        if (evidenceObjects.length !== evidenceCount || reports.length !== 1 || identities.length !== 1) return { valid: false, error: 'STIX bundle identity, evidence, and report objects must match the selected evidence.' }
        if (objects.some(item => !['identity', 'x-ti-evidence', 'report'].includes(clean(recordOrEmpty(item).type)) || recordOrEmpty(item).spec_version !== '2.1')) {
            return { valid: false, error: 'STIX bundle contains an unsupported object or spec version.' }
        }
        const evidenceObjectIds = new Set(evidenceObjects.map(item => clean(recordOrEmpty(item).id)))
        const reportObject = recordOrEmpty(reports[0])
        const objectRefs = cleanList(reportObject.object_refs)
        if (!clean(reportObject.published) || Number.isNaN(Date.parse(clean(reportObject.published)))) {
            return { valid: false, error: 'STIX report published must be a valid timestamp.' }
        }
        if (evidenceObjectIds.has('') || objectRefs.length !== evidenceObjectIds.size || objectRefs.some(id => !evidenceObjectIds.has(id))) {
            return { valid: false, error: 'STIX report object_refs must reference every selected evidence object exactly once.' }
        }
        if (evidenceObjects.some(item => {
            const evidence = recordOrEmpty(item)
            return !clean(evidence.x_ti_capture_id) || !clean(evidence.x_ti_source_id) || !clean(evidence.x_ti_content_hash)
        })) return { valid: false, error: 'STIX evidence objects require capture, source, and content-hash provenance.' }
    } else {
        if (report.schemaVersion !== 'analyst.case_export.v1') return { valid: false, error: 'JSON report must use analyst.case_export.v1.' }
        if (!Array.isArray(report.evidence) || report.evidence.length !== evidenceCount) return { valid: false, error: 'JSON report evidence must match the selected evidence.' }
    }
    return { valid: true, report }
}

function containsUnsafeReportField(value: unknown): boolean {
    if (Array.isArray(value)) return value.some(containsUnsafeReportField)
    if (!value || typeof value !== 'object') return false
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        if (/^(?:raw|body|url|sourceUrl|targetUrl|webhookUrl|authorization|cookie|password|token|secret)$/i.test(key)) return true
        if (containsUnsafeReportField(item)) return true
    }
    return false
}

export function computeOutboundThirdPartyReportChecksum(value: Record<string, unknown>) {
    const canonical = { ...value }
    delete canonical.exportChecksum
    const reportPolicy = { ...recordOrEmpty(canonical.reportPolicy) }
    delete reportPolicy.exportChecksum
    return `case_report_${crypto.createHash('sha256').update(canonicalJson({ ...canonical, reportPolicy })).digest('hex')}`
}

function recordOrEmpty(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function cleanList(value: unknown) {
    if (!Array.isArray(value)) return []
    return value.map(clean).filter(Boolean)
}

function clean(value: unknown) {
    return typeof value === 'string' ? value.trim() : ''
}
