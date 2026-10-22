import type { Metadata } from 'next'
import Link from 'next/link'
import LoginForm from '../_browser/loginForm'

export const metadata: Metadata = { title: 'Sign in | Hanasand', robots: { index: false, follow: false } }

export default function SandboxLoginPage() {
    return <main className='grid min-h-full w-full place-items-center bg-ui-canvas px-4 py-10 text-ui-text'>
        <section className='w-full max-w-lg rounded-lg border border-ui-border bg-ui-panel p-6 shadow-ui-panel'>
            <Link href='/sandbox' className='text-sm text-ui-muted hover:text-ui-text'>← Back to Sandbox</Link>
            <h1 className='mt-5 text-2xl font-semibold'>Sign in</h1>
            <p className='mt-2 text-sm text-ui-muted'>Sign in with your Identity account to sync browser history and saved profiles.</p>
            <LoginForm />
        </section>
    </main>
}
