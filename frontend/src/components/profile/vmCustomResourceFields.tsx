'use client'

export default function VmCustomResourceFields({ cpu, memory, disk, minimumMemory, minimumDisk, disabled, onCpuChange, onMemoryChange, onDiskChange }: {
    cpu: string
    memory: string
    disk: string
    minimumMemory: number
    minimumDisk: number
    disabled: boolean
    onCpuChange: (value: string) => void
    onMemoryChange: (value: string) => void
    onDiskChange: (value: string) => void
}) {
    return <div className='grid gap-3 rounded-xl border border-ui-border bg-ui-panel p-3 sm:grid-cols-3'>
        <label className='grid gap-1 text-sm text-ui-muted'>vCPU<input type='number' min='1' max='10' step='1' inputMode='numeric' value={cpu} onChange={event => onCpuChange(event.target.value)} disabled={disabled} className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
        <label className='grid gap-1 text-sm text-ui-muted'>Memory (GB)<input type='number' min={minimumMemory} max='64' step='1' inputMode='numeric' value={memory} onChange={event => onMemoryChange(event.target.value)} disabled={disabled} className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
        <label className='grid gap-1 text-sm text-ui-muted'>Disk (GB)<input type='number' min={minimumDisk} max='100' step='1' inputMode='numeric' value={disk} onChange={event => onDiskChange(event.target.value)} disabled={disabled} className='h-10 w-full rounded-lg border border-ui-border bg-ui-raised px-3 text-ui-text' /></label>
        <p className='text-xs text-ui-muted sm:col-span-3'>Up to 10 vCPU, 64 GB memory and 100GB disk.</p>
    </div>
}
