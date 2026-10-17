import { countryCentroids } from '@/utils/monitoring/geo'
import {
    CAPITAL_MARKERS, INITIAL_VIEWBOX, MAP_HEIGHT, MAP_WIDTH,
    NORWAY, panViewBox, PING_LIFETIME_MS, project, zoomViewBox, zoomViewBoxAtPointer, type LivePing, type TrafficCountryPoint, type ViewBox,
} from '@/utils/monitoring/liveTrafficMap'
import { Move } from 'lucide-react'
import { ZoomButton } from './liveMapPrimitives'
import { worldMapPaths } from './trafficMapGeometry'

type Props = {
    viewBox: ViewBox
    setViewBox: (update: ViewBox | ((current: ViewBox) => ViewBox)) => void
    dragRef: { current: { x: number, y: number, viewBox: ViewBox } | null }
    selectedCountry: string
    onSelectCountry: (iso: string) => void
    countryEntries: TrafficCountryPoint[]
    strongestCountryCount: number
    pings: LivePing[]
    now: number
}

export default function TrafficMapCanvas({ viewBox, setViewBox, dragRef, selectedCountry, onSelectCountry, countryEntries, strongestCountryCount, pings, now }: Props) {
    return (
        <div className='relative overflow-hidden' style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}>
            <div className='absolute inset-0 bg-ui-canvas' />
            <div
                className='absolute left-4 top-4 z-20 rounded-full border border-ui-border
                            bg-ui-canvas/90 px-3 py-1.5 text-xs text-ui-muted backdrop-blur'
            >
                <span className='inline-flex items-center gap-2'>
                    <Move className='h-3.5 w-3.5' />
                    Drag to pan • wheel to zoom
                </span>
            </div>
            <div
                className='absolute bottom-4 left-4 z-20 flex items-center gap-2 rounded-full
                            border border-ui-border bg-ui-canvas/90 p-1 backdrop-blur'
            >
                <ZoomButton
                    label='−'
                    onClick={() => setViewBox((current) => zoomViewBox(current, 1.18, MAP_WIDTH / 2, MAP_HEIGHT / 2))}
                />
                <ZoomButton label='Reset' wide onClick={() => setViewBox(INITIAL_VIEWBOX)} />
                <ZoomButton
                    label='+'
                    onClick={() => setViewBox((current) => zoomViewBox(current, 0.84, MAP_WIDTH / 2, MAP_HEIGHT / 2))}
                />
            </div>

            <svg
                viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                className='relative z-10 h-full w-full cursor-grab active:cursor-grabbing'
                onMouseDown={(event) => {
                    dragRef.current = { x: event.clientX, y: event.clientY, viewBox }
                }}
                onMouseMove={(event) => {
                    if (!dragRef.current) return
                    const rect = event.currentTarget.getBoundingClientRect()
                    setViewBox(panViewBox(dragRef.current, { x: event.clientX, y: event.clientY }, rect))
                }}
                onMouseUp={() => { dragRef.current = null }}
                onMouseLeave={() => { dragRef.current = null }}
                onWheel={(event) => {
                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    setViewBox(current => zoomViewBoxAtPointer(current, viewBox, { x: event.clientX, y: event.clientY }, rect, event.deltaY))
                }}
            >
                <g className='opacity-90'>{worldMapPaths}</g>

                {CAPITAL_MARKERS.map((marker) => {
                    const [x, y] = project(marker.coords)
                    const selected = marker.iso === selectedCountry
                    return (
                        <g
                            key={marker.label}
                            onClick={() => {
                                onSelectCountry(marker.iso)
                            }}
                            className='cursor-pointer'
                        >
                            <circle
                                cx={x}
                                cy={y}
                                r={selected ? 3.2 : 2.2}
                                className={selected ? 'fill-ui-text' : 'fill-ui-border'}
                            />
                            <text
                                x={x + 6}
                                y={y - 6}
                                className={`text-[9px] font-medium ${
                                    selected ? 'fill-ui-text' : 'fill-ui-muted'
                                }`}
                            >
                                {marker.label}
                            </text>
                        </g>
                    )
                })}

                {countryEntries.map((entry) => {
                    const coords = countryCentroids[entry.iso]
                    if (!coords) return null
                    const [x, y] = project(coords)
                    const radius = 4 + ((entry.count / strongestCountryCount) * 12)
                    const active = selectedCountry === entry.iso

                    return (
                        <g
                            key={entry.iso}
                            onClick={() => {
                                onSelectCountry(entry.iso)
                            }}
                            className='cursor-pointer'
                        >
                            <circle cx={x} cy={y} r={radius + 8} className='fill-ui-warning/10' />
                            <circle
                                cx={x}
                                cy={y}
                                r={radius}
                                className={active
                                    ? 'fill-ui-warning/30 stroke-ui-warning stroke-1'
                                    : 'fill-ui-warning/70 stroke-ui-canvas/40 stroke-[1.5]'}
                            />
                            <text
                                x={x}
                                y={y - radius - 5}
                                textAnchor='middle'
                                className='fill-ui-muted/50 text-[10px] font-semibold'
                            >
                                {entry.iso}
                            </text>
                        </g>
                    )
                })}

                {pings.map((ping) => {
                    const [x1, y1] = project(ping.start)
                    const [x2, y2] = project(ping.end)
                    const dx = x2 - x1
                    const dy = y2 - y1
                    const dist = Math.sqrt((dx * dx) + (dy * dy))
                    const cx = (x1 + x2) / 2
                    const cy = (y1 + y2) / 2 - (dist * 0.35)
                    const progress = (now - ping.startTime) / PING_LIFETIME_MS
                    const inverse = 1 - progress
                    const px = (inverse * inverse * x1)
                                + (2 * inverse * progress * cx)
                                + (progress * progress * x2)
                    const py = (inverse * inverse * y1)
                                + (2 * inverse * progress * cy)
                                + (progress * progress * y2)

                    return (
                        <g key={ping.id}>
                            <path
                                d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                                className='fill-none stroke-ui-border stroke-[1.2]'
                            />
                            <circle cx={px} cy={py} r={2 + Math.min(4, ping.count)} className='fill-ui-text blur-[1px]' />
                            <circle cx={px} cy={py} r='1.5' className='fill-ui-text' />
                        </g>
                    )
                })}

                <circle cx={project(NORWAY)[0]} cy={project(NORWAY)[1]} r='7' className='fill-ui-text/30 blur-sm' />
                <circle cx={project(NORWAY)[0]} cy={project(NORWAY)[1]} r='3.5' className='fill-ui-text' />
            </svg>
        </div>
    )
}
