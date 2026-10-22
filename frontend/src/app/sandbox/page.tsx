import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Sandbox',
    description: 'Investigate websites in an isolated browser session.',
}

export default function SandboxPage() {
    return <iframe
        title='Sandbox'
        src='/sandbox/ui'
        allow='autoplay; fullscreen'
        className='h-full min-h-0 w-full flex-1 border-0 bg-ui-canvas'
    />
}
