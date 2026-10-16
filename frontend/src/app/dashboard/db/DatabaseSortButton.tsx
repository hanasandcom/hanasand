import SortIndicator from '@/components/dashboard/sort-indicator'

type Props = { label: string, active: boolean, descending: boolean, onClick: () => void }

export default function DatabaseSortButton({ label, active, descending, onClick }: Props) {
    return <button type='button' onClick={onClick} aria-label={`Sort by ${label.toLowerCase()} ${active && !descending ? 'descending' : 'ascending'}`} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded py-1 text-xs focus-visible:outline-ui-primary ${active ? 'text-ui-primary' : 'text-ui-muted hover:text-ui-text'}`}>{label}<SortIndicator active={active} direction={descending ? 'desc' : 'asc'} /></button>
}
