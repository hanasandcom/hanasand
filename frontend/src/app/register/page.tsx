import { redirect } from 'next/navigation'
import { queryParamValue } from '@/utils/pagination'
import { identityAuthUrl } from '@/utils/auth/identityRedirect'

// Keep existing registration links pointed at the signup page.
export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    redirect(identityAuthUrl('signup', queryParamValue(params.path)))
}
