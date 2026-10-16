import { ChevronDown, ChevronUp, Maximize2, Minimize2, Minus, Plus, Search, ZoomIn } from 'lucide-react'
import type { CodeItem } from '@/utils/codeReviewTypes'

type Props = {
    zoom: number
    overview: boolean
    expanded: boolean
    selected?: CodeItem
    onZoomOut: () => void
    onZoomIn: () => void
    onToggleOverview: () => void
    onFocusSelected: () => void
    onOpenSearch: () => void
    onToggleExpanded: () => void
}

export function DependencyMapToolbar({
    zoom,
    overview,
    expanded,
    selected,
    onZoomOut,
    onZoomIn,
    onToggleOverview,
    onFocusSelected,
    onOpenSearch,
    onToggleExpanded,
}: Props) {
    return (
        <div className='code-map-tools'>
            <strong>Dependency map</strong>
            <button aria-label='Zoom out' onClick={onZoomOut}><Minus size={15} /></button>
            <output aria-label='Map zoom'>{Number((zoom * 100).toPrecision(3))}%</output>
            <button aria-label='Zoom in' onClick={onZoomIn}><Plus size={15} /></button>
            <button
                aria-label={overview ? 'Expand connections' : 'Collapse connections'}
                title={overview ? 'Expand connections' : 'Collapse connections'}
                onClick={onToggleOverview}
            >
                {overview ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            {selected && (
                <button onClick={onFocusSelected}>
                    <ZoomIn size={15} /> Focus selected
                </button>
            )}
            <button
                aria-label='Search dependency map'
                title='Search dependency map (⌘J / Ctrl+J)'
                onClick={onOpenSearch}
            >
                <Search size={15} />
            </button>
            <button
                aria-label={expanded ? 'Minimize dependency map' : 'Enlarge dependency map'}
                title={expanded ? 'Minimize dependency map' : 'Enlarge dependency map'}
                aria-pressed={expanded}
                onClick={onToggleExpanded}
            >
                {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
        </div>
    )
}
