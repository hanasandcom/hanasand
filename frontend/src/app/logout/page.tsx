import LogoutPageClient from './pageClient'
import { queryParamValue } from '@/utils/pagination'

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await searchParams
    const path = queryParamValue(params.path)

    // @ts-expect-error Complains that the type is incorrect, but its not
    // supposed to return anything since it is a JSX element responsible for
    // redirecting to another JSX element after logging out the user.
    return <LogoutPageClient path={path} />
}
