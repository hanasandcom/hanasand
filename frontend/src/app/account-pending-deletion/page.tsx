import PendingDeletionPage from './pageClient'
import { queryParamValue } from '@/utils/pagination'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    return <PendingDeletionPage
        id={queryParamValue(params.id) || ''}
        restoreToken={queryParamValue(params.restoreToken) || ''}
        deletionScheduledAt={queryParamValue(params.deletionScheduledAt) || ''}
    />
}
