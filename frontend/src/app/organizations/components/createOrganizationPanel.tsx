import type { Dispatch, RefObject, SetStateAction } from 'react'
import type { OrganizationRole } from '../types/organization'
import type { WatchlistKind } from '../types/watchlists'
import type { RowMessage } from '../types/activity'
import { Field, SelectField, RowStatus } from './shared'
import { inputClass, primaryButtonClass } from '../constants/styles'
import { roleOptions, watchlistKinds } from '../constants/options'
import { slugifyOrganizationName } from '../model/organization'
import { Building2 } from 'lucide-react'

type Draft = { kind: WatchlistKind, value: string, notes: string }
type Props = {
    name: string
    setName: Dispatch<SetStateAction<string>>
    nameRef: RefObject<HTMLInputElement | null>
    normalizedName: string
    nameInUse: boolean
    firstWatchlist: Draft
    setFirstWatchlist: Dispatch<SetStateAction<Draft>>
    inviteEmails: string
    setInviteEmails: Dispatch<SetStateAction<string>>
    inviteRole: OrganizationRole
    setInviteRole: Dispatch<SetStateAction<OrganizationRole>>
    invalidEmails: string[]
    parsedEmails: string[]
    busy: string
    createOrganization: () => void
    rowMessage?: RowMessage
}

export function CreateOrganizationPanel(props: Props) {
    const { name, setName, nameRef, normalizedName, nameInUse, firstWatchlist, setFirstWatchlist,
        inviteEmails, setInviteEmails, inviteRole, setInviteRole, invalidEmails, parsedEmails,
        busy, createOrganization, rowMessage } = props
    return <section id='org-create-primary' className='rounded-lg border border-ui-border bg-ui-panel p-4 shadow-sm dark:border-ui-border dark:bg-ui-panel' data-org-create-primary='true'>
        <h2 className='flex items-center gap-2 text-sm font-semibold text-ui-text dark:text-ui-text'><Building2 className='h-4 w-4 text-ui-primary' />Create organization</h2>
        <div className='mt-3 grid gap-3'>
            <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>Name
                <input ref={nameRef} value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder='Acme Security' />
                {nameInUse && <span className='text-xs font-semibold text-ui-text dark:text-ui-text'>Organization already exists.</span>}
                {!nameInUse && normalizedName && <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>Slug: {slugifyOrganizationName(normalizedName)}</span>}
            </label>
            <div className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas' data-org-create-first-watchlist='true'>
                <div className='grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]'>
                    <SelectField label='First term' value={firstWatchlist.kind} options={watchlistKinds} disabled={Boolean(busy)} onChange={value => setFirstWatchlist({ ...firstWatchlist, kind: value as WatchlistKind })} />
                    <Field label='Value' value={firstWatchlist.value} disabled={Boolean(busy)} onChange={value => setFirstWatchlist({ ...firstWatchlist, value })} placeholder='company.com, supplier, actor' />
                </div>
                <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>Notes
                    <input value={firstWatchlist.notes} disabled={Boolean(busy)} onChange={event => setFirstWatchlist({ ...firstWatchlist, notes: event.target.value })} className={inputClass} placeholder='Initial monitoring reason' />
                </label>
            </div>
            <div id='org-create-invites' className='grid gap-2 rounded-lg border border-ui-border bg-ui-raised p-3 dark:border-ui-border dark:bg-ui-canvas' data-org-create-first-invites='true'>
                <label className='grid gap-1 text-sm font-medium text-ui-text dark:text-ui-muted'>First invites
                    <textarea value={inviteEmails} disabled={Boolean(busy)} onChange={event => setInviteEmails(event.target.value)} className={`${inputClass} min-h-20 resize-y`} placeholder='analyst@company.com, admin@company.com' />
                    {invalidEmails.length > 0 && <span className='text-xs font-semibold text-ui-text dark:text-ui-text'>Invalid: {invalidEmails[0]}</span>}
                    {invalidEmails.length === 0 && parsedEmails.length > 0 && <span className='text-xs font-semibold text-ui-muted dark:text-ui-muted'>{parsedEmails.length} recipient{parsedEmails.length === 1 ? '' : 's'}</span>}
                </label>
                <SelectField label='Invite role' value={inviteRole} options={roleOptions} disabled={Boolean(busy)} onChange={value => setInviteRole(value as OrganizationRole)} />
            </div>
            <button type='button' onClick={createOrganization} disabled={!normalizedName || nameInUse || invalidEmails.length > 0 || Boolean(busy)} className={primaryButtonClass}><Building2 className='h-4 w-4' />Create organization</button>
            <RowStatus message={rowMessage} />
        </div>
    </section>
}
