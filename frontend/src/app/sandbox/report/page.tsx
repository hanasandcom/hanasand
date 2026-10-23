import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import BrowserReportPageClient from '../_browser/browser/report/pageClient'

export const metadata: Metadata = {
    title: 'Sandbox Report',
    description: 'Shareable domain investigation report with evidence, provider verdicts, network activity, and analyst actions.',
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default async function SandboxReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    if (!searchParams.run) redirect('/sandbox')
    return <BrowserReportPageClient runId={searchParams.run} token={searchParams.token} />
}
