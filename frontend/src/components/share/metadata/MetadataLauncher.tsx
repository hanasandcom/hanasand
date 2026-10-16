import { Eye, Info as InfoIcon } from 'lucide-react'
import type { MouseEvent } from 'react'

const sharedStyles = 'absolute grid place-items-center rounded-lg cursor-move z-100 select-none border border-ui-border bg-ui-panel/85 p-5 text-ui-muted backdrop-blur-md transition hover:bg-ui-raised hover:text-ui-text'

type Props = {
    isCompactViewport: boolean
    isConnected: boolean
    participants: number
    position: { x: number, y: number }
    onStartDrag(event: MouseEvent<HTMLButtonElement>): void
    onOpen(): void
}

export default function MetadataLauncher({ isCompactViewport, isConnected, participants, position, onStartDrag, onOpen }: Props) {
    const color = isConnected ? 'text-ui-success/45 group-hover:text-ui-success' : 'text-ui-muted'
    const compactStyle = isCompactViewport ? { right: 16, bottom: 88 } : { top: position.y, left: position.x }
    return (
        <button
            type='button'
            aria-label='Open share metadata'
            onMouseDown={event => { if (!isCompactViewport) onStartDrag(event) }}
            onClick={onOpen}
            className={`group ${isCompactViewport ? 'fixed right-4 bottom-22 grid place-items-center rounded-lg border border-ui-border bg-ui-panel/90 p-3 text-ui-muted shadow-2xl backdrop-blur-md hover:bg-ui-raised hover:text-ui-text' : sharedStyles}`}
            style={compactStyle}
        >
            <h1><InfoIcon className={!isConnected ? color : 'text-ui-muted group-hover:text-ui-text'} /></h1>
            {isConnected ? <h1 className='flex gap-2 text-ui-muted group-hover:text-ui-text'>{participants}<Eye className={color} /></h1> : null}
        </button>
    )
}
