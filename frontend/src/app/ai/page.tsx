import AIWorkspacePage from './AIWorkspacePage'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Hanasand GPT',
    description: 'Chat with Hanasand GPT.',
    path: '/ai',
    keywords: ['hanasand gpt', 'chat'],
})

export default async function page() {
    return AIWorkspacePage()
}
