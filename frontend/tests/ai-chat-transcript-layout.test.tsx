// @ts-expect-error Bun provides this module when running tests.
import { expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ChatTranscript } from '../src/components/ai/chat/chatTranscript'

test('chat transcript stays within the composer content width', () => {
    const html = renderToStaticMarkup(createElement(ChatTranscript, {
        conversation: null,
        scrollRef: { current: null },
        hasReadyModel: false,
        isAuthenticated: false,
        onEditPrompt: () => {},
        onDeletePrompt: () => {},
        onMovePrompt: () => {},
        onPreview: () => {},
    }))

    expect(html).toContain('mx-auto w-full max-w-4xl space-y-6')
})
