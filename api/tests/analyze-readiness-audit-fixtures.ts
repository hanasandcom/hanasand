import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { readinessArguments, readinessCanonical, readinessChainPayload, readinessWrapperArguments, type ReadinessExecutionProof } from '../src/utils/events/analyzeReadinessAudit.ts'
import type { CollectorLog } from '../src/utils/events/analyzeCollector.ts'

const keys = generateKeyPairSync('ed25519')
const quote = (value: string) => /^[\w@%+=:,./-]+$/.test(value) ? value : '\'' + value.replaceAll('\'', '\'"\'"\'') + '\''

export function fixture(serial = 0): { logs: CollectorLog[], fact: ReadinessExecutionProof } {
    const time = Date.parse('2026-09-24T00:00:00.100Z') + serial * 5000, nonce = '3e735e7b-4d7f-444d-9806-' + String(231260000000 + serial)
    const fact: ReadinessExecutionProof = { version: 2, host: 'inspur', containerId: 'a'.repeat(64), execId: createHash('sha256').update(`exec:${serial}`).digest('hex'), bootId: '3e735e7b-4d7f-444d-9806-231fa26cfcec',
        execPid: 11000, execParentPid: 10000, execStartTicks: '123450', parentPid: 12000, parentStartTicks: '123456', namespacePid: 12, nonce, startedAt: time - 10, finishedAt: time + 100, previousStartedAt: time - 5010 }
    const argumentsByRole = [ ['/bin/sh', '-c', 'pg_isready -U hanasand -d hanasand'], ['/bin/sh', '/usr/local/bin/pg_isready', '-U', 'hanasand', '-d', 'hanasand'], readinessWrapperArguments(nonce), readinessArguments(nonce) ]
    const logs = argumentsByRole.map((args, index): CollectorLog => {
        const command = args.map(quote).join(' '), auditId = String(42 + serial * 10 + index), timestamp = time + index
        return { service: 'audit', host: 'inspur', level: 'info', message: command, timestamp: new Date(timestamp).toISOString(),
            sourceEventId: createHash('sha256').update(`inspur:audit:msg=audit(${(timestamp / 1000).toFixed(3)}:${auditId})`).digest('hex'),
            metadata: { collector: 'auditd', event_type: 'process', action: 'exec', outcome: 'success', audit_id: auditId,
                process: { executable: index === 3 ? args[0] : '/usr/bin/dash', command_line: command, arguments: args, pid: String([fact.execPid, fact.parentPid, fact.parentPid, 12345][index]), parent_pid: String([fact.execParentPid, fact.execPid, fact.execPid, fact.parentPid][index]) }, user: { id: '0', login_id: '4294967295' } } }
    })
    return { logs, fact }
}

export function signed(logs: CollectorLog[], fact: ReadinessExecutionProof): CollectorLog[] {
    const result = structuredClone(logs)
    for (const log of result) delete log.metadata!.readiness_execution
    const payload = readinessChainPayload(result, fact)
    if (!payload) throw new Error('Invalid test chain cannot be signed')
    result[0].metadata!.readiness_execution = { ...payload, signature: sign(null, Buffer.from(readinessCanonical(payload)), keys.privateKey).toString('base64') }
    return result
}

export function configure() {
    process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex')
}
