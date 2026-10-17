import { expect, test } from 'bun:test'
import { readSuccessfulCaseDetail, readSuccessfulJson } from '../src/app/dashboard/ti/workbench/modules/payloadParsing'

test('reads successful case detail responses through the shared contract', async () => {
    await expect(readSuccessfulCaseDetail(Response.json({ case: { id: 'case-1' } })))
        .resolves.toEqual({ case: { id: 'case-1' } })
})

test('surfaces case detail API errors and malformed responses consistently', async () => {
    await expect(readSuccessfulCaseDetail(Response.json({ error: { message: 'Case is unavailable.' } }, { status: 404 })))
        .rejects.toThrow('Case is unavailable.')
    await expect(readSuccessfulCaseDetail(new Response('{', { status: 502, statusText: 'Bad Gateway' })))
        .rejects.toThrow('Case detail response was not JSON.')
})

test('returns parsed payloads from successful responses', async () => {
    await expect(readSuccessfulJson(Response.json({ watchlist: { id: 'watchlist-1' } })))
        .resolves.toEqual({ watchlist: { id: 'watchlist-1' } })
})

test('keeps malformed successful JSON as an empty payload', async () => {
    await expect(readSuccessfulJson(new Response('{', { status: 200 }))).resolves.toEqual({})
})

test('uses API error messages before status text', async () => {
    const response = Response.json({ error: { message: 'Action was rejected.' } }, { status: 409, statusText: 'Conflict' })
    await expect(readSuccessfulJson(response)).rejects.toThrow('Action was rejected.')
})

test('uses status text when a failed response has malformed or missing error JSON', async () => {
    await expect(readSuccessfulJson(new Response('{', { status: 503, statusText: 'Unavailable' })))
        .rejects.toThrow('Unavailable')
    await expect(readSuccessfulJson(Response.json({}, { status: 502, statusText: 'Bad Gateway' })))
        .rejects.toThrow('Bad Gateway')
})
