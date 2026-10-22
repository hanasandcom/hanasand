import { setTimeout as retryDelay } from 'node:timers/promises'
import { normalizeJsonRule, evaluateJsonRule, sharedJsonSnapshot } from './jsonMonitoring.ts'
import { hostCheckMessage, hostMetricsDataWarning } from './hostCheckMessage.ts'
import { recoveryCheckMessage } from './recoveryMonitoring.ts'
import { MonitoringResponseError } from './monitoringResponseError.ts'
import { readableMonitoringMessage } from './monitoringMessage.ts'
import type { AutomationRow } from './automationTypes.ts'
import { checkCertificate, certificateTarget, getCertificateFromError } from './automationNetwork.ts'
import { runHttpCheck, runSocketCheck } from './automationNetworkChecks.ts'

function invertsMonitoringResult(automation: Pick<AutomationRow, 'upside_down' | 'expected_down'>) {
    return automation.upside_down || automation.expected_down
}
export async function runMonitoringCheck(automation: AutomationRow) {
    const context = { monitorName: automation.name, targetUrl: automation.target_url, formatUnknown: true }
    if (!automation.target_url) throw new Error(readableMonitoringMessage('Monitoring is missing the URL to check.', context))
    let target: URL | null
    let tlsTarget: URL | null
    try {
        target = ['tcp', 'ssh', 'json'].includes(automation.monitoring_type) ? null : new URL(automation.target_url)
        tlsTarget = automation.monitoring_type === 'json' ? null : certificateTarget(automation)
    } catch {
        throw new Error(readableMonitoringMessage('Monitoring target URL is invalid.', context))
    }
    let certificate: Awaited<ReturnType<typeof checkCertificate>> | { status: 'not_applicable' | 'invalid', subject: null, issuer: null, expiresAt: null } | null = tlsTarget ? null : /^http:/i.test(automation.target_url) ? { status: 'invalid', subject: null, issuer: null, expiresAt: null } : { status: 'not_applicable', subject: null, issuer: null, expiresAt: null }
    let lastError: unknown
    for (let attempt = 0; attempt <= automation.retry_count; attempt += 1) {
        if (attempt) await retryDelay(attempt * 1000)
        try {
            if (automation.monitoring_type === 'json') return await runJsonCheck(automation, attempt)
            // Certificate validation and the monitored request are independent
            // checks. Running them sequentially lets a slow TLS handshake
            // consume the entire HTTP request budget and report a false
            // timeout even when the endpoint is healthy.
            const timeoutMs = automation.timeout_seconds * 1000
            if (timeoutMs <= 0) throw new DOMException('Monitoring request timed out.', 'TimeoutError')
            const certificatePromise = tlsTarget
                ? checkCertificate(tlsTarget, timeoutMs)
                    .catch(() => ({ status: 'invalid' as const, subject: null, issuer: null, expiresAt: null }))
                : Promise.resolve(certificate!)
            const requestPromise = target ? runHttpCheck(target, automation, timeoutMs) : runSocketCheck(automation, timeoutMs)
            const [checkedCertificate, result] = await Promise.all([certificatePromise, requestPromise])
            certificate = checkedCertificate
            if (certificate.status === 'invalid' && tlsTarget) {
                const message = readableMonitoringMessage(`TLS certificate validation failed for ${tlsTarget.hostname}.`, context)
                throw new MonitoringResponseError(message)
            }
            const healthy = invertsMonitoringResult(automation) ? !result.up : result.up
            const message = `${automation.monitoring_type.toUpperCase()} check ${healthy ? 'passed' : 'failed'}: ${automation.target_url} ${result.detail}.`
            const readableMessage = readableMonitoringMessage(message, context)
            if (!healthy) throw new MonitoringResponseError(readableMessage)
            // A successful HTTP/TCP check is healthy regardless of response latency.
            // Latency alerts need an explicit per-check threshold, not an implicit warning.
            return { provider: 'hanasand-monitoring', model: automation.monitoring_type, message: readableMessage, certificate: certificate!, warning: false }
        } catch (error) {
            if (error instanceof MonitoringResponseError) throw Object.assign(error, { certificate: getCertificateFromError(error) ?? certificate })
            lastError = error instanceof DOMException && error.name === 'TimeoutError'
                ? new Error(`Monitoring request timed out after ${automation.timeout_seconds} second${automation.timeout_seconds === 1 ? '' : 's'}.`)
                : error
        }
    }
    const message = lastError instanceof Error ? lastError.message : 'Monitoring request failed.'
    if (automation.target_url === 'system:metrics') {
        return {
            provider: 'hanasand-monitoring', model: 'json',
            message: hostMetricsDataWarning(automation.name, lastError),
            certificate: certificate!, warning: true,
        }
    }
    const detail = `${message} Failed after ${automation.retry_count + 1} attempt${automation.retry_count ? 's' : ''}.`
    const failure = Object.assign(new Error(readableMonitoringMessage(detail, context)), { certificate: getCertificateFromError(lastError) ?? certificate })
    throw failure
}

async function runJsonCheck(automation: AutomationRow, attempt: number) {
    // Retry unavailable snapshots, but evaluate each received snapshot exactly once.
    let snapshot: Awaited<ReturnType<typeof sharedJsonSnapshot>>
    try {
        snapshot = await sharedJsonSnapshot(automation, attempt)
    } catch (error) {
        if (error instanceof MonitoringResponseError) {
            error.message = readableMonitoringMessage(error.message, { monitorName: automation.name, targetUrl: automation.target_url, formatUnknown: true })
        }
        throw error
    }
    const certificate = snapshot.certificate
    let rule: ReturnType<typeof normalizeJsonRule>
    let evaluated: ReturnType<typeof evaluateJsonRule>
    try {
        rule = normalizeJsonRule(automation.json_rule)
        evaluated = evaluateJsonRule(snapshot.payload, rule)
    } catch (error) {
        if (automation.target_url === 'system:metrics') {
            return { provider: 'hanasand-monitoring', model: 'json', message: hostMetricsDataWarning(automation.name, error), certificate, warning: true }
        }
        const message = error instanceof Error ? error.message : 'JSON check failed.'
        throw Object.assign(new MonitoringResponseError(readableMonitoringMessage(message, { monitorName: automation.name, targetUrl: automation.target_url, formatUnknown: true }), { cause: error }), { certificate })
    }
    const { exceeded, observed } = evaluated
    const inverted = invertsMonitoringResult(automation)
    const failed = inverted ? !exceeded : exceeded
    const message = (automation.target_url === 'system:metrics' ? hostCheckMessage(rule, observed, failed, inverted) : null)
        ?? (automation.target_url === 'system:recovery' ? recoveryCheckMessage(snapshot.payload, rule, inverted) : null)
        ?? `JSON ${failed ? 'threshold exceeded' : 'check passed'}: ${rule.path} = ${observed}; alert ${rule.operator} ${rule.value} (${rule.aggregate}).`
    if (failed) {
        const readableMessage = readableMonitoringMessage(message, {
            monitorName: automation.name, targetUrl: automation.target_url, jsonPayload: snapshot.payload,
        })
        throw Object.assign(new MonitoringResponseError(readableMessage), { certificate })
    }
    return { provider: 'hanasand-monitoring', model: 'json', message, certificate, warning: false }
}
