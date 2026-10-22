import { redirect } from 'next/navigation'

export default async function BrowserResultPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ run?: string }> }) {
    const [{ id }, query] = await Promise.all([params, searchParams])
    const suffix = query.run ? `?run=${encodeURIComponent(query.run)}` : ''
    redirect(`/sandbox/${encodeURIComponent(id)}${suffix}`)
}
