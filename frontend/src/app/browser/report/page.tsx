import { redirect } from 'next/navigation'

export default async function BrowserReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    const query = new URLSearchParams()
    if (searchParams.run) query.set('run', searchParams.run)
    if (searchParams.token) query.set('token', searchParams.token)
    redirect(query.size ? `/sandbox/report?${query}` : '/sandbox')
}
