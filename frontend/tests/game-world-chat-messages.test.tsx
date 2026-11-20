import { strict as assert } from 'node:assert'
import { test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import GameChatMessages, { type WorldChatMessage } from '../src/app/studio/gameChatMessages'

test('world chat groups consecutive senders, separates days, and gives each bubble a time', () => {
    const now = new Date(2026, 10, 20, 12)
    const yesterday = new Date(2026, 10, 19, 23, 55)
    const firstToday = new Date(2026, 10, 20, 0, 5)
    const secondToday = new Date(2026, 10, 20, 0, 6)
    const postgresTime = firstToday.toISOString().replace('T', ' ').replace('Z', '+00')
    const messages: WorldChatMessage[] = [
        { id: 1, name: 'Alice', body: 'yesterday', source: 'game', created_at: yesterday.toISOString() },
        { id: 2, name: 'eirikhanasand', body: 'hei', source: 'web', created_at: postgresTime },
        { id: 3, name: 'eirikhanasand', body: 'hello', source: 'web', created_at: secondToday.toISOString() },
        { id: 4, name: 'Alice', body: 'reply', source: 'game', created_at: new Date(2026, 10, 20, 0, 7).toISOString() },
    ]
    const html = renderToStaticMarkup(<GameChatMessages messages={messages} now={now} />)

    assert.equal((html.match(/>Today<\/time>/g) || []).length, 1)
    assert.match(html, /<time dateTime="2026-11-20">Today<\/time>/)
    assert.match(html, /November 19, 2026/)
    assert.equal((html.match(/<strong/g) || []).length, 3)
    assert.equal((html.match(/<strong[^>]*>eirikhanasand<\/strong>/g) || []).length, 1)
    assert.equal((html.match(/group-hover:opacity-100/g) || []).length, messages.length)
    assert.equal((html.match(/Sent from website chat/g) || []).length, 2)
    assert.match(html, /rounded-2xl[^>]*>.*hei/s)
    assert.match(html, new RegExp(firstToday.toISOString().replaceAll('.', '\\.')))
})
