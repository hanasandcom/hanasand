type NoteDraft = { title: string, content: string }

export function resolveSelectedNote(notes: Note[], selectedId: string) {
    if (!selectedId) return null
    return notes.find((note) => note.id === selectedId) || notes[0] || null
}

export function saveNoteDraft(selected: Note | null, draft: NoteDraft, actions: {
    create: (draft: NoteDraft) => Promise<Note>
    update: (id: string, draft: NoteDraft) => Promise<Note>
}) {
    return selected ? actions.update(selected.id, draft) : actions.create(draft)
}
