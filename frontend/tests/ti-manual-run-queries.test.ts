import { expect, test } from 'bun:test'
import { manualRunQueries } from '../src/app/dashboard/ti/manualRunQueries'

test('manual collection targets preserve first-seen order and the existing marker filter', () => {
    const queries = manualRunQueries([
        { domains: ['example.com', 'only', 'second.test'] },
        { domains: ['example.com', 'readonly.example', 'third.test'] },
    ])

    expect(queries).toEqual(['example.com', 'second.test', 'third.test'])
})
