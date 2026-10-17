import { object, redact, stringValue } from './shared.ts'
import type { Event, NormalizedEvent } from './types.ts'

export function normalizeEvent(event: Event, source: Record<string, unknown>): NormalizedEvent {
    const original = { ...event }
    delete original.service_log_id
    delete original.references
    const adapted = adaptVendorEvent(original, source)
    const user = object(adapted.user)
    const sourceContext = object(adapted.source)
    const timestamp = typeof adapted.timestamp === 'string' && !Number.isNaN(Date.parse(adapted.timestamp)) ? new Date(adapted.timestamp).toISOString() : ''
    const vendor = stringValue(source.vendor) || 'custom'
    const product = stringValue(source.product) || 'generic-json'
    const parserVersion = vendor.toLowerCase().includes('azure') || product.toLowerCase().includes('entra') ? 'event.azure-entra.v1' : vendor.toLowerCase().includes('defender') || product.toLowerCase().includes('defender') ? 'event.defender.v1' : /suricata|snort|eve|network/i.test(`${vendor} ${product}`) ? 'event.network-eve.v1' : 'event.v1'
    return {
        timestamp,
        eventType: stringValue(adapted.event_type || adapted.category) || 'unknown',
        action: stringValue(adapted.action) || 'unknown',
        outcome: stringValue(adapted.outcome || adapted.result) || 'unknown',
        userId: stringValue(user.id || adapted.user_id),
        userEmail: stringValue(user.email || adapted.user_email),
        sourceIp: stringValue(sourceContext.ip || adapted.source_ip),
        sourceCountry: stringValue(sourceContext.country || adapted.country),
        sourceCity: stringValue(sourceContext.city || adapted.city),
        deviceId: stringValue(object(adapted.device).id || adapted.device_id),
        sourceVendor: vendor,
        sourceProduct: product,
        parserVersion,
        normalized: redact({ ...adapted, source_vendor: vendor, source_product: product, timestamp }),
        original: redact(original),
    }
}

export function adaptVendorEvent(event: Event, source: Record<string, unknown>): Event {
    const vendor = `${stringValue(source.vendor) || ''} ${stringValue(source.product) || ''}`.toLowerCase()
    if (/azure|entra|azure ad|microsoft identity/.test(vendor)) {
        const location = object(event.location)
        const detail = object(event.deviceDetail || event.device_detail)
        const resultType = event.resultType ?? event.result_type
        const geo = object(location.geoCoordinates)
        return { ...event, timestamp: event.timestamp || event.timeGenerated || event.TimeGenerated, event_type: event.event_type || 'authentication', action: event.action || 'login', outcome: event.outcome || (String(resultType ?? '').toLowerCase() === '0' || String(resultType ?? '').toLowerCase() === 'success' ? 'success' : resultType !== undefined ? 'failure' : 'unknown'), user: event.user || { id: event.user_id || event.userId || event.userPrincipalName || event.user_principal_name, email: event.user_email || event.userPrincipalName || event.user_principal_name }, source: { ...object(event.source), ip: object(event.source).ip || event.callerIpAddress || event.caller_ip_address, country: object(event.source).country || location.countryOrRegion || location.country, city: object(event.source).city || location.city, coordinates: object(event.source).coordinates || { latitude: geo.latitude, longitude: geo.longitude } }, device: event.device || { id: event.device_id || detail.deviceId || detail.device_id } }
    }
    if (/defender|endpoint/.test(vendor)) {
        const result = event.ResultType ?? event.resultType ?? event.result
        const actionType = event.ActionType || event.action_type
        return { ...event, timestamp: event.timestamp || event.Timestamp || event.timeGenerated, event_type: event.event_type || 'authentication', action: event.action || (actionType ? 'login' : 'unknown'), outcome: event.outcome || (String(result ?? '').toLowerCase() === 'success' || String(result ?? '') === '0' ? 'success' : result !== undefined ? 'failure' : 'unknown'), user: event.user || { id: event.user_id || event.AccountSid || event.accountSid || event.AccountName || event.accountName, email: event.user_email || event.AccountName || event.accountName }, source: { ...object(event.source), ip: object(event.source).ip || event.IpAddress || event.IPAddress || event.RemoteIP, country: object(event.source).country || event.CountryCode, city: object(event.source).city || event.City }, device: event.device || { id: event.device_id || event.DeviceId || event.MachineId || event.machineId } }
    }
    if (/suricata|snort|eve|network/.test(vendor)) {
        const alert = object(event.alert)
        return { ...event, timestamp: event.timestamp || event.tstamp || event.Timestamp, event_type: event.event_type || (alert.signature_id || alert.signature ? 'network' : event.event_type), action: event.action || (alert.signature_id || alert.signature ? 'alert' : 'network'), outcome: event.outcome || (alert.signature_id || alert.signature ? 'detected' : 'unknown'), source: { ...object(event.source), ip: object(event.source).ip || event.src_ip || event.srcip, city: object(event.source).city || event.src_port, country: object(event.source).country || event.proto }, signature_id: event.signature_id || alert.signature_id, signature: event.signature || alert.signature }
    }
    return event
}

export function validateEventFields(events: Event[]) {
    return events.flatMap((event, index) => {
        if (event.timestamp === undefined) return []
        if (typeof event.timestamp !== 'string' || Number.isNaN(Date.parse(event.timestamp))) {
            return [{ field: `events[${index}].timestamp`, message: 'timestamp must be a valid ISO-8601 date string.' }]
        }
        return []
    })
}
