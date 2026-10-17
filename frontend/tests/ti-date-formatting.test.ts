import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDate as formatQueryDate } from '../src/app/ti/queryPresentation'
import { formatDate as formatCaseStudyDate } from '../src/app/ti/businessModelCaseStudies'
import { formatDate as formatArtifactDate } from '../src/utils/ti/actorArtifactUtils'

test('TI consumers share UTC ISO date formatting while retaining their empty-value contracts', () => {
    const offsetDate = '2026-01-02T23:00:00-05:00'
    assert.equal(formatQueryDate(offsetDate), '2026-01-03')
    assert.equal(formatCaseStudyDate(offsetDate), '2026-01-03')
    assert.equal(formatArtifactDate(offsetDate), '2026-01-03')
    assert.equal(formatQueryDate(''), 'Date unavailable')
    assert.equal(formatCaseStudyDate(''), '')
    assert.equal(formatArtifactDate(''), '')
    assert.equal(formatQueryDate('unknown'), 'unknown')
})
