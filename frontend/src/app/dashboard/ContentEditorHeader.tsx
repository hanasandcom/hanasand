import { Trash, type LucideIcon } from 'lucide-react'

type Props = { icon: LucideIcon, label: string, title: string, onDelete: () => void }

export default function ContentEditorHeader({ icon: Icon, label, title, onDelete }: Props) {
    return (
        <div className='flex items-center justify-between gap-3'>
            <div className='min-w-0'>
                <div className='flex items-center gap-2 text-ui-primary'>
                    <Icon className='h-4 w-4 shrink-0' />
                    <p className='text-xs font-semibold uppercase text-ui-primary'>{label}</p>
                </div>
                <h1 className='mt-2 truncate text-xl font-medium text-ui-text'>{title}</h1>
            </div>
            <button
                type='button'
                onClick={onDelete}
                className='inline-flex h-9 items-center gap-2 rounded-lg border border-ui-danger/40 bg-ui-raised/10 px-3.5 text-sm font-medium text-ui-text transition hover:bg-ui-raised/15'
            >
                <Trash className='h-4 w-4' />
                Delete
            </button>
        </div>
    )
}
