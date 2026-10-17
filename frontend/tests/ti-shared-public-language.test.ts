import { expect, test } from 'bun:test'
import { displayRequirementText } from '../src/app/ti/model/requirementCopy'
import { publicTiText } from '../src/app/ti/publicResultText'

const wording = 'PROOF proof readiness actionability receipt contract named examples target signals signal control room dashboard slop acceptance criteria teasers teaser'

test('shared TI wording remains case-insensitive and keeps each surface actionability copy', () => {
    expect(publicTiText(wording)).toBe('evidence evidence status next-step status record schema reported activity targeting indicators indicator console low-value summary requirements summaries summary')
    expect(displayRequirementText(wording)).toBe('evidence evidence status action status record schema reported activity targeting indicators indicator console low-value summary requirements summaries summary')
})

test('public results and requirement copy retain distinct route wording', () => {
    const routes = 'GET /api/organizations/acme/alert-status /v1/cases'
    expect(publicTiText(routes)).toBe('Check organization alert state case records')
    expect(displayRequirementText(routes)).toBe('Check organization alert state case actions')
})
