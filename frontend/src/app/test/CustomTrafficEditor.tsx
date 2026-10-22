'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { maxCustomDurationSeconds, maxCustomStages, totalDurationSeconds, type CustomTrafficStage } from '@/utils/test/trafficShapes'

type Props = { stages: CustomTrafficStage[], onChange: (stages: CustomTrafficStage[]) => void }
const width = 620
const height = 240
const left = 42
const right = 596
const top = 20
const bottom = 190

export default function CustomTrafficEditor({ stages, onChange }: Props) {
    const [mode, setMode] = useState<'graph' | 'inputs'>('graph')
    const svgRef = useRef<SVGSVGElement>(null)
    const draggingIndex = useRef<number | null>(null)
    const seconds = totalDurationSeconds(stages)
    const chartPoints = stages.map((stage, index) => {
        const start = stages.slice(0, index).reduce((sum, item) => sum + item.durationSeconds, 0)
        const end = start + stage.durationSeconds
        return { x: left + ((start + end) / 2 / seconds) * (right - left), y: bottom - stage.target / 100 * (bottom - top), start, end, target: stage.target }
    })

    function setTarget(index: number, target: number) {
        onChange(stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, target: clamp(Math.round(target), 0, 100) } : stage))
    }

    function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
        if (draggingIndex.current === null || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        const svgY = (event.clientY - rect.top) / rect.height * height
        setTarget(draggingIndex.current, ((bottom - clamp(svgY, top, bottom)) / (bottom - top)) * 100)
    }

    function updateStage(index: number, patch: Partial<CustomTrafficStage>) {
        const availableSeconds = maxCustomDurationSeconds - totalDurationSeconds(stages.filter((_, stageIndex) => stageIndex !== index))
        const boundedPatch = patch.durationSeconds === undefined
            ? patch
            : { ...patch, durationSeconds: clamp(patch.durationSeconds, 1, Math.max(1, availableSeconds)) }
        onChange(stages.map((stage, stageIndex) => stageIndex === index ? { ...stage, ...boundedPatch } : stage))
    }

    function addStage() {
        if (stages.length >= maxCustomStages || seconds >= maxCustomDurationSeconds) return
        onChange([...stages, { durationSeconds: Math.min(10, maxCustomDurationSeconds - seconds), target: stages.at(-1)?.target ?? 1 }])
    }

    return (
        <section className='grid gap-3 rounded-lg border border-ui-border bg-ui-raised p-3'>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>Custom traffic</h3>
                    <p className='text-xs text-ui-muted'>Drag points to change users over time. Up to 100 users and 10 minutes.</p>
                </div>
                <div className='flex rounded-md border border-ui-border bg-ui-panel p-1' aria-label='Custom traffic editor mode'>
                    {(['graph', 'inputs'] as const).map(value => <button key={value} type='button' aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded px-2.5 py-1 text-xs font-semibold capitalize ${mode === value ? 'bg-ui-primary text-ui-on-primary' : 'text-ui-muted'}`}>{value}</button>)}
                </div>
            </div>

            {mode === 'graph' ? <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role='application' aria-label='Custom traffic graph. Drag a stage point up or down.' onPointerMove={handlePointerMove} onPointerUp={() => { draggingIndex.current = null }} onPointerCancel={() => { draggingIndex.current = null }} className='h-auto w-full touch-none rounded-md border border-ui-border bg-ui-panel'>
                {[0, 50, 100].map(value => {
                    const y = bottom - value / 100 * (bottom - top)
                    return <g key={value}><line x1={left} x2={right} y1={y} y2={y} stroke='currentColor' className='text-ui-border' /><text x={left - 8} y={y + 4} textAnchor='end' className='fill-ui-muted text-[10px]'>{value}</text></g>
                })}
                <text x='6' y={top + 8} className='fill-ui-muted text-[10px]'>Traffic</text>
                {chartPoints.map((point, index) => {
                    const x1 = left + point.start / seconds * (right - left)
                    const x2 = left + point.end / seconds * (right - left)
                    const nextY = chartPoints[index + 1]?.y ?? point.y
                    return <g key={index}>
                        <line x1={x1} x2={x2} y1={point.y} y2={point.y} stroke='currentColor' strokeWidth='3' className='text-ui-primary' />
                        {index < chartPoints.length - 1 && <line x1={x2} x2={x2} y1={point.y} y2={nextY} stroke='currentColor' strokeWidth='3' className='text-ui-primary' />}
                        <circle cx={point.x} cy={point.y} r='8' fill='currentColor' className='cursor-ns-resize text-ui-primary focus:outline-none' tabIndex={0} role='slider' aria-label={`Stage ${index + 1} traffic`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={point.target} onPointerDown={event => { draggingIndex.current = index; event.currentTarget.setPointerCapture(event.pointerId) }} onKeyDown={event => { if (event.key === 'ArrowUp') setTarget(index, point.target + 1); if (event.key === 'ArrowDown') setTarget(index, point.target - 1) }} />
                        <text x={point.x} y={Math.max(top + 12, point.y - 12)} textAnchor='middle' className='fill-ui-text text-[11px]'>{point.target}</text>
                    </g>
                })}
                <text x={left} y={height - 10} className='fill-ui-muted text-[10px]'>0s</text>
                <text x={right} y={height - 10} textAnchor='end' className='fill-ui-muted text-[10px]'>{seconds}s</text>
                <text x={width / 2} y={height - 10} textAnchor='middle' className='fill-ui-muted text-[10px]'>Seconds</text>
            </svg> : <div className='grid gap-2'>
                <div className='hidden grid-cols-[1fr_1fr_auto] gap-2 text-xs font-semibold text-ui-muted sm:grid'><span>Stage duration (seconds)</span><span>Users</span><span /></div>
                {stages.map((stage, index) => <div key={index} className='grid grid-cols-[1fr_1fr_auto] items-center gap-2'>
                    <input aria-label={`Stage ${index + 1} duration in seconds`} type='number' min={1} max={maxCustomDurationSeconds} value={stage.durationSeconds} onChange={event => updateStage(index, { durationSeconds: clamp(Number(event.target.value) || 1, 1, maxCustomDurationSeconds) })} className='h-9 min-w-0 rounded border border-ui-border bg-ui-panel px-2 text-sm text-ui-text' />
                    <input aria-label={`Stage ${index + 1} users`} type='number' min={0} max={100} value={stage.target} onChange={event => updateStage(index, { target: clamp(Number(event.target.value) || 0, 0, 100) })} className='h-9 min-w-0 rounded border border-ui-border bg-ui-panel px-2 text-sm text-ui-text' />
                    <button type='button' disabled={stages.length <= 1} onClick={() => onChange(stages.filter((_, stageIndex) => stageIndex !== index))} className='h-9 rounded border border-ui-border px-2 text-xs text-ui-muted disabled:opacity-40'>Remove</button>
                </div>)}
                <p className='text-xs text-ui-muted'>Total: {seconds} seconds</p>
            </div>}

            <div className='flex items-center justify-between gap-3'>
                <span className='text-xs text-ui-muted'>{stages.length} of {maxCustomStages} stages · {seconds}s total</span>
                <button type='button' disabled={stages.length >= maxCustomStages || seconds >= maxCustomDurationSeconds} onClick={addStage} className='h-8 rounded border border-ui-border px-3 text-xs font-semibold text-ui-text disabled:opacity-40'>Add stage</button>
            </div>
        </section>
    )
}

function clamp(value: number, minimum: number, maximum: number) {
    return Math.min(maximum, Math.max(minimum, value))
}
