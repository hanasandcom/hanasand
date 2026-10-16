// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { expectedToolCompletionText } from './toolCompletionText'

test('builds the visible completion copy for supported tools', () => {
    expect(expectedToolCompletionText('<hanasand-tool>{"action":"scaffold_nextjs_docker","projectName":"Demo"}</hanasand-tool>'))
        .toBe('Scaffolded a Next.js + Docker workspace for Demo. The workspace is attached and ready for follow-up edits.')
    expect(expectedToolCompletionText('{"action":"create_project","projectName":"Demo"}')).toBe('Created project workspace for Demo')
    expect(expectedToolCompletionText('{"action":"run_terminal_command","command":"npm test"}')).toBe('Command: npm test')
    expect(expectedToolCompletionText('{"action":"http_request","url":"https://example.test"}')).toBe('HTTP GET https://example.test')
    expect(expectedToolCompletionText('{"action":"browser_task","url":"https://example.test"}')).toBe('Tool browser_task executed for URL: https://example.test')
    expect(expectedToolCompletionText('No tool payload')).toBeNull()
})
