import { reviewStatus, type CodeItem } from '@/utils/codeReviewTypes'
import { ItemIcon, names, statusNames } from './codeReviewShared'

type Node = { item: CodeItem, x: number, y: number }

export function DependencyMapSvg({ nodes, selected, zoom, height, onSelect }: {
    nodes: Node[]
    selected: CodeItem
    zoom: number
    height: number
    onSelect: (id: string) => void
}) {
    return (
        <svg role='group' aria-label={`Dependencies of ${selected.title}`} width={1010 * zoom} height={height * zoom} viewBox={`0 0 1010 ${height}`}>
            <text x='10' y='28'>Used by</text>
            <text x='350' y='28'>Selected</text>
            <text x='690' y='28'>Depends on</text>
            {nodes.slice(1).map(({ item, x, y }) => <path
                key={'edge:' + item.id + x}
                d={x < 350
                    ? `M310 ${y + 22} C330 ${y + 22} 330 92 350 92`
                    : `M650 92 C670 92 670 ${y + 22} 690 ${y + 22}`}
            />)}
            {nodes.map(({ item, x, y }) => <g
                key={item.id + x}
                role='button'
                tabIndex={0}
                aria-label={`${item.title}, ${item.dependencyCount} dependencies`}
                onClick={() => onSelect(item.id)}
                onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    onSelect(item.id)
                }}
            >
                <title>{item.title} · {names[item.kind]} · {statusNames[reviewStatus(item)]}</title>
                <rect x={x} y={y} width='300' height='44' rx='8' data-selected={item.id === selected.id} />
                <g transform={`translate(${x + 12},${y + 4})`}><ItemIcon item={item} /></g>
                <text x={x + 32} y={y + 17} className='code-map-kind'>{names[item.kind]}</text>
                <text x={x + 12} y={y + 34}>
                    {item.title.length > 36 ? '…' + item.title.slice(-35) : item.title}
                </text>
                {item.dependencyCount > 0 && <>
                    <circle cx={x + 279} cy={y + 9} r='13' />
                    <text x={x + 279} y={y + 13} textAnchor='middle' className='code-map-count'>{item.dependencyCount}</text>
                </>}
            </g>)}
        </svg>
    )
}
