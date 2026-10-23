import { HelpCircle } from 'lucide-react'

export function UvmHelp({ label, text }: { label: string, text: string }) {
    return <details className='relative inline-flex shrink-0 text-ui-muted'>
        <summary aria-label={`About ${label}`} className='grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-ui-border text-xs font-semibold hover:bg-ui-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ui-primary [&::-webkit-details-marker]:hidden'>
            <HelpCircle aria-hidden='true' className='h-4 w-4' />
        </summary>
        <p className='absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-ui-border bg-ui-panel p-3 text-xs leading-5 text-ui-text shadow-lg'>{text}</p>
    </details>
}
