import type { Dispatch, SetStateAction } from 'react'
import ReferencePanel from '@/components/share/referencePanel'
import WordControl from '@/components/share/wordControl'

type Props = {
    tree?: Tree | null
    share: Share | null
    clickedWord: string | null
    setClickedWord: Dispatch<SetStateAction<string | null>>
    editingContent: string
}

export default function SymbolPanel({ tree, share, clickedWord, setClickedWord, editingContent }: Props) {
    return (
        <>
            <WordControl clickedWord={clickedWord} />
            <ReferencePanel
                tree={tree || null}
                share={share}
                clickedWord={clickedWord}
                setClickedWord={setClickedWord}
                editingContent={editingContent}
            />
        </>
    )
}
