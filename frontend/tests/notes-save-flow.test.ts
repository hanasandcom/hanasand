import { expect, test } from 'bun:test'
import { resolveSelectedNote, saveNoteDraft } from '../src/app/dashboard/notes/notesModel'

const existingNote: Note = {
    id: 'existing', title: 'Existing', content: 'Keep this', source: 'website',
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

test('New note followed by Save creates a note without updating the previous note', async () => {
    const calls: string[] = []
    const draft = { title: 'New', content: 'New content' }
    const saved = await saveNoteDraft(resolveSelectedNote([existingNote], ''), draft, {
        create: async (value) => { calls.push(`create:${value.title}`); return { ...existingNote, id: 'new', ...value } },
        update: async (id, value) => { calls.push(`update:${id}:${value.title}`); return { ...existingNote, ...value } },
    })

    expect(saved.id).toBe('new')
    expect(calls).toEqual(['create:New'])
})

test('a cleared selection stays empty while a stale selected ID falls back to the first note', () => {
    expect(resolveSelectedNote([existingNote], '')).toBeNull()
    expect(resolveSelectedNote([existingNote], 'removed')).toBe(existingNote)
})
