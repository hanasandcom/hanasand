import type { ThesisDocument } from '@/utils/thesis'

export type UndoState = { undo: number, redo: number }

export class ThesisUndoHistory {
    private past: ThesisDocument[] = []
    private future: ThesisDocument[] = []
    private lastGroup: string | undefined
    private lastEdit = 0

    constructor(private readonly onChange: (state: UndoState) => void) {}

    clear() {
        this.past = []
        this.future = []
        this.lastGroup = undefined
        this.publish()
    }

    remember(draft: ThesisDocument, group?: string) {
        const now = Date.now()
        if (!group || group !== this.lastGroup || now - this.lastEdit > 750 || this.future.length) {
            this.past = [...this.past.slice(-49), draft]
        }
        this.future = []
        this.lastGroup = group
        this.lastEdit = now
        this.publish()
    }

    travel(draft: ThesisDocument, revision: number, redo: boolean): ThesisDocument | null {
        const previous = (redo ? this.future : this.past).pop()
        if (!previous) return null
        if (redo) this.past.push(draft)
        else this.future.push(draft)
        this.lastGroup = undefined
        this.publish()
        return { ...previous, revision }
    }

    private publish() {
        this.onChange({ undo: this.past.length, redo: this.future.length })
    }
}
