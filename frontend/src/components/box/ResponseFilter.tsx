import { Search } from 'lucide-react'

type ResponseFilterProps = {
    accessibleLabel: string
    placeholder: string
    value: string
    onChange: (value: string) => void
}

export default function ResponseFilter({ accessibleLabel, placeholder, value, onChange }: ResponseFilterProps) {
    return <label className='flex h-10 items-center gap-2 border-b border-ui-border px-3 text-ui-text/45'>
        <Search className='h-3.5 w-3.5 shrink-0' />
        <span className='sr-only'>{accessibleLabel}</span>
        <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className='min-w-0 flex-1 bg-transparent text-xs text-ui-text/78 outline-none placeholder:text-ui-text/32'
        />
    </label>
}
