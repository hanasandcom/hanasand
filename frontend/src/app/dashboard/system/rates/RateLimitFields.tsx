'use client'

import type { ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { dateInputToIso, isoToDateInput } from './model'

export function StatChip({ label, value }: { label: string, value: string }) {
    return (
        <div className='rounded-lg border border-ui-border bg-ui-panel px-3 py-3'>
            <p className='text-[10px] uppercase tracking-[0.22em] text-ui-muted'>{label}</p>
            <p className='mt-1 text-base font-semibold text-ui-text'>{value}</p>
        </div>
    )
}

export function TextField({ label, value, onChange }: { label: string, value: string, onChange: (value: string) => void }) {
    return <LabeledField label={label}><input value={value} onChange={(event) => onChange(event.target.value)} className={inputStyle} /></LabeledField>
}

export function DateField({ label, value, onChange }: { label: string, value: string, onChange: (value: string) => void }) {
    return <LabeledField label={label}><input type='date' value={isoToDateInput(value)} onChange={(event) => onChange(dateInputToIso(event.target.value))} className={inputStyle} /></LabeledField>
}

export function NumberField({
    label,
    value,
    min,
    onChange,
}: {
    label: string
    value: number
    min: number
    onChange: (value: number) => void
}) {
    return <LabeledField label={label}><input type='number' min={min} value={value} onChange={(event) => onChange(Number(event.target.value || 0))} className={inputStyle} /></LabeledField>
}

export function SelectField({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: string[]
    onChange: (value: string) => void
}) {
    return <LabeledField label={label}><select value={value} onChange={(event) => onChange(event.target.value)} className={inputStyle}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select></LabeledField>
}

export function RouteChooser({
    label,
    routeOptions,
    value,
    onChange,
}: {
    label: string
    routeOptions: string[]
    value: string
    onChange: (value: string) => void
}) {
    return <LabeledField label={label}><input list='rate-limit-routes' value={value} onChange={(event) => onChange(event.target.value)} placeholder={routeOptions[0] || 'GET /api/'} className={inputStyle} /></LabeledField>
}

function LabeledField({ label, children }: { label: string, children: ReactNode }) {
    return <label className='grid gap-1.5 text-sm text-ui-muted'><span>{label}</span>{children}</label>
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
    return (
        <button type='button' onClick={onClick} className='inline-flex items-center justify-center rounded-lg border border-ui-danger/30 bg-ui-raised/10 px-3 py-2 text-ui-text transition-colors hover:bg-ui-raised/15'>
            <Trash2 className='h-4 w-4' />
        </button>
    )
}

export function EmptyState({ message }: { message: string }) {
    return <div className='rounded-lg border border-dashed border-ui-border bg-ui-panel px-4 py-6 text-sm text-ui-muted'>{message}</div>
}

const inputStyle = 'h-10 rounded-lg border border-ui-border bg-ui-raised px-3 text-sm text-ui-text outline-none transition-colors focus:border-ui-primary/35'
