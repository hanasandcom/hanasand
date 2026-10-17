import { AppConfirmDialog } from '@/components/ui/appDialog'

export function TreeItemDeleteDialog({
    name,
    kind,
    open,
    onCancel,
    onConfirm,
}: {
    name: string
    kind: 'file' | 'folder'
    open: boolean
    onCancel: () => void
    onConfirm: () => void
}) {
    return <AppConfirmDialog
        open={open}
        title={`Delete ${name}?`}
        body={kind === 'file' ? 'This file will be deleted from the share.' : 'Everything inside this folder will be deleted.'}
        confirmLabel='Delete'
        tone='danger'
        onCancel={onCancel}
        onConfirm={onConfirm}
    />
}
