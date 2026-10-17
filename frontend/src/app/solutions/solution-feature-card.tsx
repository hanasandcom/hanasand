import type { ReactNode } from 'react'

export default function SolutionFeatureCard({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
    return <article className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-4'><span className='text-ui-primary'>{icon}</span><h2 className='font-semibold'>{title}</h2><p className='text-sm leading-6 text-ui-muted'>{detail}</p></article>
}
