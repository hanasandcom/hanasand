import ErrorNotice from '@/components/error/errorNotice'

export function VmReconnectNotice({ title, message }: { title: string, message: string }) {
    return <ErrorNotice compact variant='info' className='mt-3' title={title} message={message} />
}
