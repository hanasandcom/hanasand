import { expect, test } from 'bun:test'
import { monitoringIssueFingerprint } from '../src/utils/monitoringIssues.ts'

const automation = {
    target_url: 'https://logs.hanasand.com/api/metrics',
    monitoring_type: 'json',
    json_rule: { path: 'current.alert', operator: 'eq', value: true },
}

test('log throughput cases retain one fingerprint while rates and backlog change', () => {
    const first = 'Logs throughput is outside its configured limits: NPPS (incoming load ÷ checked throughput) 0 below 100×; processing rate 0 below 200 logs/s. Pending backlog: 9943432. Check incoming traffic, processing workers, and the pending backlog.'
    const later = 'Logs throughput is outside its configured limits: NPPS (incoming load ÷ checked throughput) 0.5 below 100×; processing rate 24 below 200 logs/s. Pending backlog: 9949000. Check incoming traffic, processing workers, and the pending backlog.'
    expect(monitoringIssueFingerprint(automation, 'failure', first)).toBe(monitoringIssueFingerprint(automation, 'failure', later))
    expect(monitoringIssueFingerprint(automation, 'warning', first)).not.toBe(monitoringIssueFingerprint(automation, 'failure', later))
    expect(monitoringIssueFingerprint({ ...automation, json_rule: { ...automation.json_rule, value: false } }, 'failure', first))
        .not.toBe(monitoringIssueFingerprint(automation, 'failure', later))
})
