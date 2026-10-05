import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { buildRouteMetadata } from '../../seo'
import BrowserReportPageClient from '../../browser/report/pageClient'

const reportMetadata = buildRouteMetadata({
    title: 'Sandbox Report',
    description: 'Shareable domain investigation report with evidence, provider verdicts, network activity, and analyst actions.',
    path: '/sandbox/report',
    keywords: ['sandbox report', 'url analysis report', 'soc evidence report'],
})

export const metadata: Metadata = {
    ...reportMetadata,
    alternates: null,
    openGraph: reportMetadata.openGraph ? { ...reportMetadata.openGraph, url: undefined } : undefined,
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export default async function SandboxReportPage(props: { searchParams: Promise<{ run?: string; token?: string }> }) {
    const searchParams = await props.searchParams
    if (!searchParams.run || !searchParams.token) redirect('/sandbox')
    return <BrowserReportPageClient runId={searchParams.run} token={searchParams.token} />
}
