import Editor from '@/components/editor/editor'
import ErrorNotice from '@/components/error/errorNotice'
import { Plus, type LucideIcon } from 'lucide-react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

type Props = {
    icon: LucideIcon, label: string, title: string, error: string | null
    editing: boolean, setEditing: Dispatch<SetStateAction<boolean>>
    id: string, content: string[], onChange: (content: string) => void
    onCreate: () => void, children?: ReactNode, editorGap?: 'gap-4' | 'gap-5'
}

export default function CreateContentEditor(props: Props) {
    const { icon: Icon, label, title, error, editing, setEditing, id, content, onChange, onCreate, children, editorGap = 'gap-4' } = props
    const editorProps = {
        editing,
        setEditing,
        customSaveLogic: true as const,
        hideSaveButton: true as const,
        className: 'rounded-lg border border-ui-border bg-ui-raised p-2 shadow-sm shadow-ui-canvas/20',
        id,
        content,
        onChange,
    }

    return (
        <div className={`relative grid gap-4 ${editing ? '' : 'px-4 md:px-[18vw]'}`}>
            <div className='flex items-center justify-between gap-3'>
                <div>
                    <div className='flex items-center gap-2 text-ui-primary'><Icon className='h-4 w-4' /><p className='text-xs font-semibold uppercase text-ui-primary'>{label}</p></div>
                    <h1 className='mt-2 text-xl font-medium text-ui-text'>{title}</h1>
                </div>
                <button type='button' onClick={onCreate} className='ui-button ui-button-primary h-9 px-3.5 text-sm'><Plus className='h-4 w-4' />Create</button>
            </div>
            <ErrorNotice compact message={error} />
            <div className={`grid w-full ${editorGap}`}>
                {children}
                <Editor {...editorProps} />
            </div>
        </div>
    )
}
