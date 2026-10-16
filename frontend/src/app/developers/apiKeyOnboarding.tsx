'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { ArrowRight, CheckCircle2, LoaderCircle, Plus, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiKeyStep, FirstRequestStep, OrganizationStep, StateLine } from './ApiKeyOnboardingSteps'
import { errorMessage, responseJson } from './apiKeyOnboardingData'
import type { ApiKey, Organization } from './apiKeyOnboardingTypes'

export default function ApiKeyOnboarding({ server }: { server: string }) {
    const [headerAction, setHeaderAction] = useState<HTMLElement | null>(null)
    const [state, setState] = useState<'loading' | 'signed-out' | 'ready' | 'error'>('loading')
    const [organizations, setOrganizations] = useState<Organization[]>([])
    const [organizationId, setOrganizationId] = useState('')
    const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
    const [secret, setSecret] = useState('')
    const [busy, setBusy] = useState('')
    const [message, setMessage] = useState('')
    const [confirmRevoke, setConfirmRevoke] = useState('')

    useEffect(() => {
        setHeaderAction(document.getElementById('api-key-header-action'))
        void loadOrganizations()
    }, [])

    async function loadOrganizations() {
        setState('loading')
        try {
            const response = await fetch('/api/organizations', { cache: 'no-store' })
            if (response.status === 401) return setState('signed-out')
            const payload = await responseJson<{ organizations?: Organization[] }>(response)
            const next = (payload.organizations ?? []).filter(organization => organization.role === 'owner' || organization.role === 'admin')
            setOrganizations(next)
            if (next[0]) {
                setOrganizationId(next[0].id)
                await loadApiKeys(next[0].id)
            }
            setState('ready')
        } catch (error) {
            setMessage(errorMessage(error))
            setState('error')
        }
    }

    async function loadApiKeys(id: string) {
        const response = await fetch(`/api/organizations/${encodeURIComponent(id)}/api-keys`, { cache: 'no-store' })
        const payload = await responseJson<{ apiKeys?: ApiKey[] }>(response)
        setApiKeys(payload.apiKeys ?? [])
    }

    async function selectOrganization(id: string) {
        setOrganizationId(id)
        setSecret('')
        setMessage('')
        setConfirmRevoke('')
        setBusy('load')
        try {
            await loadApiKeys(id)
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    async function createOrganization(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const element = event.currentTarget
        const form = new FormData(element)
        const name = String(form.get('organizationName') || '').trim()
        if (name.length < 2) return setMessage('Enter an organization name.')
        setBusy('organization')
        setMessage('')
        try {
            const response = await fetch('/api/organizations', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            const payload = await responseJson<{ organization?: Organization }>(response)
            if (!payload.organization) throw new Error('Organization creation did not return an organization.')
            setOrganizations([payload.organization])
            setOrganizationId(payload.organization.id)
            setApiKeys([])
            element.reset()
            setMessage('Organization created. Create its API key next.')
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    async function createApiKey(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const element = event.currentTarget
        const form = new FormData(element)
        const name = String(form.get('keyName') || '').trim()
        setBusy('key')
        setMessage('')
        try {
            const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/api-keys`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ name }),
            })
            const payload = await responseJson<{ apiKey: ApiKey, secret: string }>(response)
            setSecret(payload.secret)
            await loadApiKeys(organizationId)
            element.reset()
            setMessage('API key created. Copy the secret now; it is not stored in retrievable form.')
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    async function revokeApiKey(keyId: string) {
        if (confirmRevoke !== keyId) return setConfirmRevoke(keyId)
        setBusy(keyId)
        setMessage('')
        try {
            const response = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/api-keys/${encodeURIComponent(keyId)}`, { method: 'DELETE' })
            await responseJson(response)
            setSecret('')
            setConfirmRevoke('')
            await loadApiKeys(organizationId)
            setMessage('API key revoked. Calls using it now return invalid_api_key.')
        } catch (error) {
            setMessage(errorMessage(error))
        } finally {
            setBusy('')
        }
    }

    const selected = organizations.find(organization => organization.id === organizationId)
    const activeKey = apiKeys.find(apiKey => apiKey.enabled)
    const firstRequest = `curl "${server}/actors?page=1&limit=20" \\\n  -H "X-API-Key: ${secret || '$HANASAND_API_KEY'}"`

    const headerActionClass = 'inline-flex h-11 items-center gap-2 rounded-lg bg-ui-text px-4 text-sm font-semibold text-ui-canvas transition hover:opacity-90 disabled:opacity-60'

    return (
        <section id='api-access' className='scroll-mt-24 border-b border-ui-border bg-ui-canvas'>
            {headerAction && createPortal(state === 'signed-out' ? (
                <Link href='/register?path=%2Fdevelopers%23api-access' className={headerActionClass}>Create account<ArrowRight className='h-4 w-4' /></Link>
            ) : state === 'ready' && !activeKey ? (
                <button type='submit' form={selected ? 'create-api-key-form' : 'create-api-organization-form'} disabled={Boolean(busy)} className={headerActionClass}>
                    {busy === 'load' ? 'Loading…' : busy ? 'Creating…' : selected ? 'Create API key' : 'Create organization'}<ArrowRight className='h-4 w-4' />
                </button>
            ) : null, headerAction)}
            <div className='mx-auto grid max-w-7xl gap-6 px-4 py-6 md:px-8'>
                <div className='max-w-3xl'>
                    <p className='text-sm font-semibold uppercase text-ui-primary'>Customer onboarding</p>
                    <h2 className='mt-2 text-3xl font-semibold'>Organization, API key, first request.</h2>
                    <p className='mt-3 text-sm leading-7 text-ui-muted'>Each key is for one organization, expires after 90 days, and is shown only once.</p>
                </div>

                {state === 'loading' ? <StateLine icon={<LoaderCircle className='h-4 w-4 animate-spin' />} text='Checking your signed-in organizations.' /> : null}
                {state === 'signed-out' ? (
                    <div className='grid gap-4 rounded-lg border border-ui-border bg-ui-panel p-5 md:grid-cols-[1fr_auto] md:items-center'>
                        <div><h3 className='font-semibold'>Sign in to create a real key</h3><p className='mt-1 text-sm leading-6 text-ui-muted'>New accounts continue back here, create an organization, and can issue the first key without a sales ticket.</p></div>
                        <div className='flex flex-wrap gap-2'>
                            <Link href='/register?path=%2Fdevelopers%23api-access' className='inline-flex h-10 items-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary'>Create account<Plus className='h-4 w-4' /></Link>
                            <Link href='/login?path=%2Fdevelopers%23api-access' className='inline-flex h-10 items-center rounded-lg border border-ui-border bg-ui-raised px-4 text-sm font-semibold'>Log in</Link>
                        </div>
                    </div>
                ) : null}
                {state === 'error' ? <StateLine icon={<ShieldCheck className='h-4 w-4 text-ui-text' />} text={message || 'API access onboarding is temporarily unavailable.'} /> : null}

                {state === 'ready' ? (
                    <div className='grid gap-4 lg:grid-cols-3'>
                        <OrganizationStep organizations={organizations} organizationId={organizationId} busy={busy} onSelect={selectOrganization} onCreate={createOrganization} />
                        <ApiKeyStep selected={Boolean(selected)} activeKey={activeKey} busy={busy} confirmRevoke={confirmRevoke} onCreate={createApiKey} onRevoke={revokeApiKey} />
                        <FirstRequestStep secret={secret} code={firstRequest} />
                    </div>
                ) : null}

                {state === 'ready' && message ? <StateLine icon={<CheckCircle2 className='h-4 w-4 text-ui-primary' />} text={message} /> : null}
            </div>
        </section>
    )
}
