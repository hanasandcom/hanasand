import { createHash } from 'node:crypto'
import { modelLogDigest, modelProofMac, type ModelProbeLog } from '../../src/utils/events/analyzeModelDiscovery.ts'

export const testKey = 'ab'.repeat(32)

export function modelFixture(index = 1): ModelProbeLog {
    const cursor = `s=${'a'.repeat(32)};i=${index.toString(16)};b=${'b'.repeat(32)};m=1;t=1;x=1`
    const start = Date.parse('2026-09-23T21:00:00Z') + index * 10000
    const nonce = `12345678-1234-4234-8234-${index.toString(16).padStart(12, '0')}`
    const path = `/v1/models?hanasand_probe=${nonce}`
    const log: ModelProbeLog = {
        host: 'inspur', service: 'run_model_inspur_vllm_gpu.sh', level: 'info',
        message: `(APIServer pid=1143552) INFO:     127.0.0.1:34764 - "GET ${path} HTTP/1.1" 200 OK`,
        timestamp: new Date(start + 10).toISOString(), sourceEventId: createHash('sha256').update(`inspur:journal:${cursor}`).digest('hex'),
        metadata: { collector: 'journal', pid: '1143552', unit: 'hanasand-model.service', user: { id: '1000' }, cursor },
    }
    const proof = { version: 1, nonce, host: 'inspur', caller: 'hanasand-ai-model-client', method: 'GET', path,
        clientIp: '127.0.0.1', clientPort: 34764, serverIp: '127.0.0.1', serverPort: 18081, serverPid: '1143552',
        logSha256: modelLogDigest(log, cursor), startedAt: start, finishedAt: start + 20, previousStartedAt: start - 10000,
        status: 200, bodyEmpty: true, responseSha256: 'c'.repeat(64), model: 'hanasand', responseRoot: 'Qwen/Qwen2.5-Coder-7B-Instruct',
        headers: { host: '127.0.0.1:18081', accept: 'application/json', connection: 'close' } }
    log.metadata!.model_probe = { ...proof, mac: modelProofMac(proof, testKey) }
    return log
}
