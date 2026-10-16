import { Building2, CheckCircle2, KeyRound, Plus, Trash2 } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import CopyCodeButton from './copyCodeButton'
import { formatApiKeyDate } from './apiKeyOnboardingData'
import type { ApiKey, Organization } from './apiKeyOnboardingTypes'

export function OrganizationStep({ organizations, organizationId, busy, onSelect, onCreate }: {
    organizations: Organization[]
    organizationId: string
    busy: string
    onSelect: (id: string) => void
    onCreate: (event: FormEvent<HTMLFormElement>) => void
}) {
    const selected = organizations.find(organization => organization.id === organizationId)

    return <article className='rounded-lg border border-ui-border bg-ui-panel p-5'>
        <div className='flex items-center gap-2'>
            <Building2 className='h-5 w-5 text-ui-primary' />
            <h3 className='font-semibold'>1. Organization</h3>
        </div>
        {organizations.length ? (
            <label className='mt-4 grid gap-2 text-sm font-semibold'>Organization
                <select
                    value={organizationId}
                    onChange={event => void onSelect(event.target.value)}
                    disabled={busy === 'load'}
                    className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 font-normal'
                >
                    {organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
                </select>
                <span className='text-xs font-normal text-ui-muted'>{selected?.role ? `${selected.role} access` : 'Signed-in member'}</span>
            </label>
        ) : (
            <form id='create-api-organization-form' className='mt-4 grid gap-3' onSubmit={onCreate}>
                <label className='grid gap-2 text-sm font-semibold'>
                    Organization name
                    <input
                        name='organizationName'
                        minLength={2}
                        maxLength={120}
                        required
                        className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 font-normal'
                        placeholder='Example Security Team'
                    />
                </label>
                <button
                    disabled={busy === 'organization'}
                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-60'
                >
                    {busy === 'organization' ? 'Creating' : 'Create organization'}
                    <Plus className='h-4 w-4' />
                </button>
            </form>
        )}
    </article>
}

export function ApiKeyStep({ selected, activeKey, busy, confirmRevoke, onCreate, onRevoke }: {
    selected: boolean
    activeKey?: ApiKey
    busy: string
    confirmRevoke: string
    onCreate: (event: FormEvent<HTMLFormElement>) => void
    onRevoke: (id: string) => void
}) {
    return <article className='rounded-lg border border-ui-border bg-ui-panel p-5'>
        <div className='flex items-center gap-2'>
            <KeyRound className='h-5 w-5 text-ui-primary' />
            <h3 className='font-semibold'>2. API key</h3>
        </div>
        {!selected ? <p className='mt-4 text-sm leading-6 text-ui-muted'>Create an organization first.</p> : activeKey ? (
            <div className='mt-4 grid gap-3 text-sm'>
                <div className='rounded-lg border border-ui-border bg-ui-canvas p-3'>
                    <p className='font-semibold'>{activeKey.name}</p>
                    <p className='mt-1 font-mono text-xs text-ui-muted'>hsk_{activeKey.keyPrefix}_…</p>
                    <p className='mt-2 text-xs text-ui-muted'>
                        {activeKey.scopes.length} read scopes · expires {formatApiKeyDate(activeKey.expiresAt)} · last used {formatApiKeyDate(activeKey.lastUsedAt)}
                    </p>
                </div>
                <button
                    type='button'
                    onClick={() => void onRevoke(activeKey.id)}
                    disabled={busy === activeKey.id}
                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-ui-danger/40 px-3 font-semibold text-ui-text disabled:opacity-60'
                >
                    <Trash2 className='h-4 w-4' />
                    {confirmRevoke === activeKey.id ? 'Confirm revoke' : 'Revoke key'}
                </button>
            </div>
        ) : (
            <form id='create-api-key-form' className='mt-4 grid gap-3' onSubmit={onCreate}>
                <label className='grid gap-2 text-sm font-semibold'>
                    Key name
                    <input
                        name='keyName'
                        minLength={2}
                        maxLength={80}
                        required
                        className='h-11 rounded-lg border border-ui-border bg-ui-canvas px-3 font-normal'
                        defaultValue='Developer API'
                    />
                </label>
                <button
                    disabled={busy === 'key'}
                    className='inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-ui-primary px-4 text-sm font-semibold text-ui-on-primary disabled:opacity-60'
                >
                    {busy === 'key' ? 'Creating' : 'Create API key'}
                    <KeyRound className='h-4 w-4' />
                </button>
            </form>
        )}
    </article>
}

export function FirstRequestStep({ secret, code }: { secret: string, code: string }) {
    return <article className='rounded-lg border border-ui-border bg-ui-panel p-5'>
        <div className='flex items-center gap-2'>
            <CheckCircle2 className='h-5 w-5 text-ui-primary' />
            <h3 className='font-semibold'>3. First request</h3>
        </div>
        {secret ? (
            <div className='mt-4 grid gap-3'>
                <div className='rounded-lg border border-ui-warning/40 bg-ui-warning/10 p-3'>
                    <p className='text-xs font-semibold uppercase text-ui-warning'>Copy once</p>
                    <p className='mt-2 break-all font-mono text-xs text-ui-text'>{secret}</p>
                    <div className='mt-3'><CopyCodeButton value={secret} label='Copy key' /></div>
                </div>
                <FirstRequest code={code} />
            </div>
        ) : (
            <div className='mt-4 grid gap-3'>
                <p className='text-sm leading-6 text-ui-muted'>Create a key to receive the real secret and a ready-to-run request. Existing secrets cannot be displayed again.</p>
                <FirstRequest code={code} />
            </div>
        )}
    </article>
}

export function StateLine({ icon, text }: { icon: ReactNode, text: string }) {
    return <div className='flex items-center gap-2 rounded-lg border border-ui-border bg-ui-panel px-4 py-3 text-sm text-ui-muted'>
        {icon}
        <span>{text}</span>
    </div>
}

function FirstRequest({ code }: { code: string }) {
    return <div className='overflow-hidden rounded-lg border border-ui-border bg-ui-panel'>
        <div className='flex items-center justify-between gap-2 border-b border-ui-border/40 px-3 py-2 text-xs font-semibold text-ui-text'>
            <span>Run from your terminal</span>
            <CopyCodeButton value={code} />
        </div>
        <pre className='overflow-x-auto whitespace-pre-wrap p-3 text-xs leading-6 text-ui-muted'>{code}</pre>
    </div>
}
