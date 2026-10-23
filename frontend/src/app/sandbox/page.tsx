import type { Metadata } from 'next'
import SandboxApplication from './_browser/SandboxApplication'

export const metadata: Metadata = {
    title: 'Sandbox',
    description: 'Investigate domains quickly. Onion addresses are also supported.',
}

export const dynamic = 'force-dynamic'

export default function SandboxPage() {
    return <SandboxApplication />
}
