import type { RefObject, Dispatch, SetStateAction } from 'react'
import type { OrganizationSummary } from '../types/organization'
import type { OrganizationPage } from '@/utils/organizations/pages'
import { organizationPages } from '@/utils/organizations/pages'
import { organizationDisplayName } from '../model/organization'
import { organizationRoleLabel } from '../model/labels'
import { primaryButtonClass } from '../constants/styles'
import { Building2, Loader2, RefreshCw, Search } from 'lucide-react'

type Props = {
    activePage: OrganizationPage
    organizations: OrganizationSummary[]
    selectedOrganization?: OrganizationSummary
    loading: boolean
    busy: string
    createFormOpen: boolean
    setCreateFormOpen: Dispatch<SetStateAction<boolean>>
    createNameRef: RefObject<HTMLInputElement | null>
    organizationSearchOpen: boolean
    setOrganizationSearchOpen: Dispatch<SetStateAction<boolean>>
    workspaceQuery: string
    setWorkspaceQuery: Dispatch<SetStateAction<string>>
    organizationSearchRef: RefObject<HTMLInputElement | null>
    visibleOrganizations: OrganizationSummary[]
    selectOrganization: (organizationId: string) => void
    loadOrganizations: (organizationId?: string) => Promise<void>
}

export function WorkspaceHeader(props: Props) {
    const { activePage, organizations, selectedOrganization, loading, busy, createFormOpen,
        setCreateFormOpen, createNameRef, organizationSearchOpen, setOrganizationSearchOpen,
        workspaceQuery, setWorkspaceQuery, organizationSearchRef, visibleOrganizations,
        selectOrganization, loadOrganizations } = props
    return (
        <header className='flex flex-col gap-4 border-b border-ui-border pb-5 dark:border-ui-border sm:flex-row sm:items-center sm:justify-between' data-org-page-header='true'>
            <div className='max-w-3xl'><h1 className='text-2xl font-semibold tracking-tight text-ui-text' data-org-page-title='true'>{organizationPages.find(item => item.id === activePage)?.label}</h1></div>
            <div className='relative flex flex-wrap items-center gap-2'>
                {organizations.length > 0 && <>
                    <span className='rounded-md border border-ui-border bg-ui-raised px-2 py-1.5 text-xs font-semibold text-ui-muted dark:border-ui-border dark:bg-ui-canvas dark:text-ui-muted' data-org-count='true'>{organizations.length}/{organizations.length}</span>
                    <button type='button' onClick={() => setOrganizationSearchOpen(open => !open)} aria-expanded={organizationSearchOpen} aria-label='Search organizations (⌘J)' title='Search organizations · ⌘J' className='inline-flex h-9 items-center gap-2 rounded-md border border-ui-border bg-ui-panel px-3 text-sm font-medium text-ui-muted hover:bg-ui-raised dark:border-ui-border dark:bg-ui-raised dark:hover:bg-ui-panel' data-org-search-trigger='true'>
                        <Search className='h-4 w-4' /><span className='hidden sm:inline'>Search</span><kbd className='rounded border border-ui-border bg-ui-canvas px-1.5 py-0.5 text-[11px] dark:border-ui-border dark:bg-ui-canvas'>⌘J</kbd>
                    </button>
                </>}
                <button type='button' className={primaryButtonClass} aria-expanded={createFormOpen || (!loading && organizations.length === 0)} aria-controls='org-create-primary' disabled={loading} onClick={() => organizations.length === 0 ? createNameRef.current?.focus() : setCreateFormOpen(open => !open)}>
                    <Building2 className='h-4 w-4' />Create organization
                </button>
                {organizations.length > 0 && <>
                    <label className='sr-only' htmlFor='organization-switcher'>Switch organization</label>
                    <select id='organization-switcher' aria-label='Switch organization' value={selectedOrganization?.id || ''} onChange={event => selectOrganization(event.target.value)} className='h-9 max-w-44 rounded-md border border-ui-border bg-ui-panel px-2 text-sm font-medium text-ui-text dark:border-ui-border dark:bg-ui-raised' data-org-switcher='true'>
                        {organizations.map(organization => <option key={organization.id} value={organization.id}>{organizationDisplayName(organization)}</option>)}
                    </select>
                </>}
                <button type='button' onClick={() => void loadOrganizations(selectedOrganization?.id)} className='inline-flex h-9 w-9 items-center justify-center rounded-md border border-ui-border bg-ui-panel text-ui-text transition hover:bg-ui-raised disabled:cursor-not-allowed disabled:opacity-60 dark:border-ui-border dark:bg-ui-raised dark:text-ui-text dark:hover:bg-ui-raised' aria-label='Refresh organizations' title='Refresh organizations' disabled={Boolean(busy || loading)}>
                    {busy === 'load-org' || loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
                </button>
                {organizationSearchOpen && <div className='absolute right-0 top-full z-30 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-ui-border bg-ui-panel shadow-xl dark:border-ui-border dark:bg-ui-panel' role='dialog' aria-label='Search organizations' data-org-search-dialog='true'>
                    <label className='flex items-center gap-2 border-b border-ui-border px-3 dark:border-ui-border'>
                        <Search className='h-4 w-4 shrink-0 text-ui-muted' />
                        <input ref={organizationSearchRef} value={workspaceQuery} onChange={event => setWorkspaceQuery(event.target.value)} className='h-11 min-w-0 flex-1 bg-transparent text-sm text-ui-text outline-none placeholder:text-ui-muted' placeholder='Search organizations' aria-label='Search organizations' />
                        <kbd className='rounded border border-ui-border px-1.5 py-0.5 text-[11px] text-ui-muted'>ESC</kbd>
                    </label>
                    <div className='max-h-80 overflow-y-auto p-1'>{visibleOrganizations.length ? visibleOrganizations.map(organization => <button type='button' key={organization.id} onClick={() => { selectOrganization(organization.id); setOrganizationSearchOpen(false); setWorkspaceQuery('') }} aria-current={selectedOrganization?.id === organization.id ? 'true' : undefined} className='flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm hover:bg-ui-raised dark:hover:bg-ui-raised' data-org-search-result='true'><span className='truncate font-medium'>{organizationDisplayName(organization)}</span><span className='shrink-0 text-xs text-ui-muted'>{organizationRoleLabel(organization.role || 'reader')}</span></button>) : <p className='px-3 py-4 text-sm text-ui-muted'>No matching organizations.</p>}</div>
                </div>}
            </div>
        </header>
    )
}
