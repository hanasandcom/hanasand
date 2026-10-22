import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../_browser/browser/seo'
import BrowserReportPageClient from '../_browser/browser/report/pageClient'

const reportMetadata = buildRouteMetadata({
    title: 'Sandbox Report',
    description: 'Shareable domain investigation report with evidence, provider verdicts, network activity, and analyst actions.',
    path: '/sandbox/report',
    keywords: ['sandbox report', 'url analysis report', 'soc evidence report'],
})

export const metadata: Metadata = {
    ...reportMetadata,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default async function SandboxReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    if (!searchParams.run) redirect('/sandbox')
    return <BrowserReportPageClient runId={searchParams.run} token={searchParams.token} />
}
