import { redirect } from 'next/navigation'
import { queryParamValue } from '@/utils/pagination'

// Keep existing registration links pointed at the signup page.
export default async function Page({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const params = await searchParams
    const query = new URLSearchParams()
    for (const key of ['path', 'internal', 'error']) {
        const value = queryParamValue(params[key])
        if (value) query.set(key, value)
    }
    redirect(`/signup${query.size ? `?${query}` : ''}`)
}
