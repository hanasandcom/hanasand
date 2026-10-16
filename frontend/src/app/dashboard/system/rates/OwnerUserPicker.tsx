'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { RefreshCw, Search } from 'lucide-react'
import { formatOwnerUser, ownerUserMeta, ownerUserSearchText, type OwnerUserOption } from './model'

export function OwnerUserPicker({
    label,
    value,
    users,
    loading,
    error,
    onChange,
    onRefresh,
}: {
    label: string
    value: string
    users: OwnerUserOption[]
    loading: boolean
    error: string | null
    onChange: (value: string) => void
    onRefresh: () => Promise<void>
}) {
    const listId = useId()
    const rootRef = useRef<HTMLDivElement | null>(null)
    const [query, setQuery] = useState('')
    const [open, setOpen] = useState(false)
    const selectedUser = users.find((user) => user.id === value.trim())
    const filteredUsers = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        if (!normalizedQuery) return users.slice(0, 8)
        return users.filter((user) => ownerUserSearchText(user).includes(normalizedQuery)).slice(0, 8)
    }, [query, users])

    useEffect(() => {
        if (open) return
        setQuery(selectedUser ? formatOwnerUser(selectedUser) : value)
    }, [open, selectedUser, value])

    return (
        <div
            ref={rootRef}
            className='relative grid gap-1.5 text-sm text-ui-muted'
            onBlur={(event) => {
                if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
            }}
        >
            <span>{label}</span>
            <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ui-muted' />
                <input
                    role='combobox'
                    aria-label={label}
                    aria-controls={listId}
                    aria-expanded={open}
                    aria-autocomplete='list'
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(event) => {
                        setQuery(event.target.value)
                        setOpen(true)
                        onChange(event.target.value)
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setOpen(false)
                    }}
                    placeholder='Search users or paste exact ID'
                    className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised pl-9 pr-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
                />
            </div>
            {open ? <OwnerOptions
                listId={listId}
                users={filteredUsers}
                selectedId={value.trim()}
                loading={loading}
                error={error}
                onRefresh={onRefresh}
                onSelect={(user) => {
                    onChange(user.id)
                    setQuery(formatOwnerUser(user))
                    setOpen(false)
                }}
            /> : null}
        </div>
    )
}

function OwnerOptions({
    listId,
    users,
    selectedId,
    loading,
    error,
    onRefresh,
    onSelect,
}: {
    listId: string
    users: OwnerUserOption[]
    selectedId: string
    loading: boolean
    error: string | null
    onRefresh: () => Promise<void>
    onSelect: (user: OwnerUserOption) => void
}) {
    return (
        <div id={listId} role='listbox' className='absolute left-0 right-0 top-[4.35rem] z-30 max-h-64 overflow-auto rounded-lg border border-ui-border bg-ui-panel p-1 shadow-2xl shadow-ui-canvas/30'>
            {loading ? <div className='px-3 py-2 text-xs text-ui-muted'>Loading users...</div> : error ? (
                <div className='grid gap-2 px-3 py-2 text-xs text-ui-muted'>
                    <span>{error}</span>
                    <button type='button' onMouseDown={(event) => event.preventDefault()} onClick={() => void onRefresh()} className='inline-flex w-fit items-center gap-2 rounded-lg border border-ui-border bg-ui-raised px-2.5 py-1.5 text-ui-muted transition-colors hover:bg-ui-raised'>
                        <RefreshCw className='h-3.5 w-3.5' />
                        Retry
                    </button>
                </div>
            ) : users.length ? users.map((user) => (
                <button key={user.id} type='button' role='option' aria-selected={user.id === selectedId} onMouseDown={(event) => event.preventDefault()} onClick={() => onSelect(user)} className='grid w-full gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-ui-raised aria-selected:bg-ui-primary/10'>
                    <span className='text-sm text-ui-text'>{user.name || user.id}</span>
                    <span className='text-xs text-ui-muted'>{ownerUserMeta(user)}</span>
                </button>
            )) : <div className='px-3 py-2 text-xs text-ui-muted'>No matching users. Paste an exact ID to use it.</div>}
        </div>
    )
}
