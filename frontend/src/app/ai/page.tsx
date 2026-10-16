import AIWorkspacePage from './AIWorkspacePage'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'Review Assistant',
    description: 'Review projects, workspaces, and shared reports in the Hanasand assistant console.',
    path: '/ai',
    keywords: ['hanasand assistant', 'workspace review', 'project review'],
})

export default async function page() {
    return AIWorkspacePage()
}
