import StatusPageMirror from './StatusPageMirror'
import type { Metadata } from 'next'
import { buildRouteMetadata } from '../seo'

export const metadata: Metadata = buildRouteMetadata({
    title: 'System Status',
    description: 'Live Hanasand service status, uptime, API health, and platform checks.',
    path: '/status',
    keywords: ['hanasand status', 'api status', 'platform status'],
})

export default function page() { return <StatusPageMirror /> }
