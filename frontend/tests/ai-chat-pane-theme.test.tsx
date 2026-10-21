// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import ChatPane from '../src/components/ai/chatPane'
import { ArtifactList, groupArtifacts } from '../src/components/ai/chat/chatArtifacts'
import { ChatComposer } from '../src/components/ai/chat/chatComposer'
import { ChatHeader } from '../src/components/ai/chat/chatHeader'
import { ChatTranscript } from '../src/components/ai/chat/chatTranscript'
import { ToolMessage } from '../src/components/ai/chat/chatMessages'
import { WorkspacePrimaryAction } from '../src/components/ai/workbenchPaneDisplay'

const noPreview = () => {}

test('empty chat keeps the prompt short and the composer primary', () => {
    const html = renderToStaticMarkup(<ChatPane
        activeConversation={null}
        clients={[{ name: 'review-model', ram: [], cpu: [], gpu: [], model: {} as GPT_ModelMetrics }]}
        composer=''
        isConnected
        isAuthenticated
        participants={1}
        onComposerChange={() => {}}
        onModelStrategyChange={() => {}}
        onPreferredModelChange={() => {}}
        onSend={() => {}}
    />)
    expect(html).toContain('What can I help with?')
    expect(html).toContain('placeholder="Message…"')
    expect(html).toContain('Starting a chat…')
    expect(html).toMatch(/aria-label="Send"[^>]*disabled=""/)
    expect(html).not.toContain('Review assistant')
    expect(html).not.toContain('Ask Hanasand to inspect context')
    expect(html).not.toContain('Attach the relevant context')
})

test('chat composer renders themed, accessible blocked and ready states', () => {
    const blocked = renderToStaticMarkup(<ChatComposer value='' blockedReason='Reviewer mode' awaitingResponse={false} readOnly onChange={() => {}} onSend={() => {}} />)
    const ready = renderToStaticMarkup(<ChatComposer value='Review this' blockedReason={null} awaitingResponse={false} readOnly={false} onChange={() => {}} onSend={() => {}} />)

    expect(blocked).toContain('focus-within:border-ui-primary')
    expect(blocked).toContain('id="ai-composer-blocked-reason"')
    expect(blocked).toContain('aria-describedby="ai-composer-blocked-reason"')
    expect(blocked).toContain('Reviewer mode')
    expect(blocked).toContain('disabled=""')
    expect(ready).toContain('aria-label="Send"')
    expect(ready).not.toContain('disabled=""')
    expect(`${blocked}${ready}`).not.toMatch(/(?:bg|text)-white|#[\da-f]{3,8}/i)
})

test('chat header keeps shared hover and primary state tokens', () => {
    const html = renderToStaticMarkup(<ChatHeader conversation={null} clients={[]} isThinking showArtifacts={false} latestArtifacts={[]} onToggleArtifacts={() => {}} onModelStrategyChange={() => {}} onPreferredModelChange={() => {}} />)

    expect(html).toContain('Hanasand GPT')
    expect(html).not.toContain('Review ready')
    expect(html).not.toContain('Paused')
    expect(html).toContain('hover:text-ui-text')
    expect(html).not.toMatch(/(?:bg|text)-white|#[\da-f]{3,8}/i)
})

test('workspace primary action preserves import, starter, and deploy button variants', () => {
    const importAction = renderToStaticMarkup(<WorkspacePrimaryAction onClick={() => {}} disabled>Importing</WorkspacePrimaryAction>)
    const starterAction = renderToStaticMarkup(<WorkspacePrimaryAction onClick={() => {}} hover>Create workspace</WorkspacePrimaryAction>)
    const deployAction = renderToStaticMarkup(<WorkspacePrimaryAction onClick={() => {}} hover disabled>Checking launch target...</WorkspacePrimaryAction>)

    expect(importAction).toContain('<button type="button" disabled="" class="rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-on-primary transition-opacity disabled:opacity-60">Importing</button>')
    expect(starterAction).toContain('<button type="button" class="rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-on-primary transition-opacity hover:opacity-90">Create workspace</button>')
    expect(deployAction).toContain('<button type="button" disabled="" class="rounded-lg bg-ui-primary px-3 py-2 text-sm font-semibold text-ui-on-primary transition-opacity hover:opacity-90 disabled:opacity-60">Checking launch target...</button>')
})

test('artifact list preserves themed summaries, newest and safe external links', () => {
    const html = renderToStaticMarkup(<ArtifactList artifacts={[
        { kind: 'log', title: 'Build log', content: 'completed' },
        { kind: 'screenshot', title: 'Preview', url: 'https://example.test', dataUrl: 'data:image/png;base64,AA==' },
    ]} onPreview={noPreview} />)

    expect(html).toContain('border border-ui-border bg-ui-panel')
    expect(html).toContain('outline outline-ui-border')
    expect(html).toContain('<details')
    expect(html).toContain('<summary')
    expect(html).toContain('Log')
    expect(html).toContain('Screenshot')
    expect(html).toContain('Verification')
    expect(html).toContain('Newest')
    expect(html).toContain('href="https://example.test"')
    expect(html).toContain('target="_blank" rel="noopener noreferrer"')
    expect(html).not.toMatch(/#[\da-f]{3,8}/i)
})

test('artifact groups keep their display labels and stable kind order', () => {
    const groups = groupArtifacts([
        { kind: 'diff', title: 'Changes' },
        { kind: 'link', title: 'Reference' },
        { kind: 'file', title: 'Report' },
        { kind: 'log', title: 'Build log' },
        { kind: 'http', title: 'Health check' },
        { kind: 'command', title: 'Build output' },
        { kind: 'screenshot', title: 'Preview' },
    ])

    expect(groups.map(({ kind, label }) => [kind, label])).toEqual([
        ['screenshot', 'Screenshots'],
        ['command', 'Command output'],
        ['http', 'HTTP checks'],
        ['log', 'Logs'],
        ['file', 'Files'],
        ['link', 'Links'],
        ['diff', 'Diffs'],
    ])
})

test('browser verification renders success and issue tones with bounded diagnostics', () => {
    const message = (content: string, error = false): AIConversationMessage => ({
        id: 'tool-1', role: 'tool', content, error, createdAt: '2026-10-17T00:00:00Z', metadata: { toolState: 'complete' },
    })
    const passed = renderToStaticMarkup(<ToolMessage message={message('Tool browser_task executed for URL: https://example.test\nTitle: Example\nPage errors:\n<none>\n\nConsole:\n<none>')} artifacts={[{ kind: 'screenshot', title: 'Preview' }]} />)
    const issues = renderToStaticMarkup(<ToolMessage message={message('Tool browser_task executed for URL: https://example.test\nTitle: Example\nPage errors:\nPage error\n\nConsole:\nConsole one\nConsole two\nConsole three\nConsole four\nConsole five')} artifacts={[]} />)
    const diagnosticList = issues.split('mt-3 space-y-1 text-xs text-current/90')[1]?.split('</div></div></div>')[0] || ''

    expect(passed).toContain('border-ui-success/30 bg-ui-success/10 text-ui-success')
    expect(passed).toContain('Verification passed')
    expect(passed).toContain('Screenshot captured')
    expect(issues).toContain('border-ui-warning/30 bg-ui-warning/10 text-ui-warning')
    expect(issues).toContain('Verification found issues')
    expect(issues).toContain('Page error')
    expect(issues).toContain('5 console messages')
    expect(diagnosticList.match(/rounded-lg bg-ui-canvas\/20/g)).toHaveLength(4)
    expect(diagnosticList).toContain('Console three')
    expect(diagnosticList).not.toContain('Console four')
})

test('transcript keeps errored messages on the danger theme', () => {
    const html = renderToStaticMarkup(<ChatTranscript conversation={{
        id: 'conversation-1', ownerId: 'user-1', title: 'Review', preferredModel: null, activeModel: null,
        modelStrategy: 'auto', workspaceId: null, workspaceKind: null, shareIds: [], workspaceMeta: {},
        messages: [{ id: 'error-1', role: 'assistant', content: 'Request failed', error: true, createdAt: '2026-10-17T00:00:00Z' }],
        collaboration: { role: 'owner', canInvite: true, seatLimit: 1, seatCount: 1, remainingSeats: 0, collaborators: [] },
        metrics: {} as GPT_ModelMetrics, createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z',
    }} scrollRef={{ current: null }} hasReadyModel={false} isAuthenticated={false} onPreview={noPreview} />)

    expect(html).toContain('rounded-xl border border-ui-danger/30')
    expect(html).toContain('Request failed')
})
