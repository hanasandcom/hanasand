import type { ReactNode } from 'react'
import { Copy, RefreshCcw } from 'lucide-react'
import { IconButton } from './SystemUi'

type Action = { label: string, icon: ReactNode, onClick: () => void }
type Props = {
    variant: 'compact' | 'full'
    displayName?: string
    leading: Action
    onCopy: () => void
    onRestart: () => void
    showRestart?: boolean
}

export function ContainerActionGroup({ variant, displayName = '', leading, onCopy, onRestart, showRestart = true }: Props) {
    if (variant === 'compact') {
        return <div className='flex justify-end gap-1'>
            <IconButton label={leading.label} onClick={leading.onClick}>{leading.icon}</IconButton>
            <IconButton label={`Copy ${displayName}`} onClick={onCopy}><Copy className='h-4 w-4' /></IconButton>
            {showRestart && <IconButton label={`Restart ${displayName}`} onClick={onRestart}><RefreshCcw className='h-4 w-4' /></IconButton>}
        </div>
    }

    return <div className='mt-3 flex flex-wrap gap-2'>
        <button type='button' onClick={leading.onClick} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm hover:bg-ui-raised'>{leading.icon}{leading.label}</button>
        <button type='button' onClick={onCopy} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-semibold text-ui-text shadow-sm hover:bg-ui-raised'><Copy className='h-4 w-4' />Copy</button>
        {showRestart && <button type='button' onClick={onRestart} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-warning/35 bg-ui-warning/10 px-3 text-sm font-semibold text-ui-warning shadow-sm hover:bg-ui-warning/15'><RefreshCcw className='h-4 w-4' />Restart</button>}
    </div>
}
