import type { ReactNode } from 'react'

export default function NotesPanelIconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
    return <button type='button' onClick={onClick} aria-label={label} title={label} className='ui-button ui-button-secondary h-9 w-9 p-0'>{children}</button>
}
