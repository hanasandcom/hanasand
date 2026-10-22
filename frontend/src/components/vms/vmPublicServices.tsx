'use client'

import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { VmPanel } from './vmPanel'
import { requestVmPublicServices, type VmPublicServicesResponse } from '@/utils/vms/fetch/publicServices'

export default function VmPublicServices({ vmName }: { vmName: string }) {
    const [publicAddress, setPublicAddress] = useState<VmPublicServicesResponse | null>(null)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let active = true
        requestVmPublicServices(vmName).then((address) => {
            if (active) { setPublicAddress(address); setError('') }
        }).catch((cause) => {
            if (active) setError(cause instanceof Error ? cause.message : 'Unable to load the VM public address.')
        }).finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [vmName])

    async function copyAddress(value: string) {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
        } catch { setError('Unable to copy the address.') }
    }

    return <VmPanel title='Public services'>
        <p className='mt-2 max-w-3xl text-sm leading-6 text-ui-muted'>This VM owns its services and port configuration. The shared gateway forwards traffic to this VM; it does not configure or connect your services to neighboring VMs.</p>
        {error && <p role='alert' className='mt-3 text-sm text-ui-danger'>{error}</p>}
        {loading && <p className='mt-4 text-sm text-ui-muted'>Loading public address…</p>}
        {publicAddress && <div className='mt-4 grid gap-3'>
            <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
                <div className='min-w-0'><p className='text-xs font-medium text-ui-muted'>VM hostname</p><p className='mt-1 break-all font-medium text-ui-text'>{publicAddress.hostname}</p></div>
                <button type='button' onClick={() => void copyAddress(publicAddress.hostname)} className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-2 text-xs text-ui-text hover:bg-ui-raised'>{copied ? <Check className='h-3.5 w-3.5' /> : <Copy className='h-3.5 w-3.5' />}{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <div className='rounded-lg border border-ui-border p-3 text-sm leading-6 text-ui-muted'>
                <p>Configure the service inside this VM. HTTP traffic uses public port <span className='font-mono text-ui-text'>80</span> and defaults to guest port 80. Minecraft Java and TLS use the shared public port <span className='font-mono text-ui-text'>443</span>; Minecraft defaults to guest port 25565 and TLS defaults to guest port 443.</p>
                <p className='mt-2 break-all font-mono text-ui-text'>{publicAddress.portAlias}:443</p>
                <p className='mt-2'>For example, <span className='font-mono text-ui-text'>25566-{vmName}.hanasand.com:443</span> forwards Minecraft Java to guest port <span className='font-mono text-ui-text'>25566</span>. For HTTPS, the VM serves TLS and its own certificate.</p>
                <p className='mt-2'>Minecraft Java, TLS SNI and HTTP Host carry the hostname through the gateway. Arbitrary plain TCP and UDP traffic cannot be selected by hostname.</p>
            </div>
        </div>}
    </VmPanel>
}
