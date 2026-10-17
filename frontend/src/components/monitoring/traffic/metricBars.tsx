import Bar from './bar'
import type { TrafficMetric, TrafficSlowMetric } from '@/utils/monitoring/types'

type MetricBarsProps = {
    entries: Array<TrafficMetric | TrafficSlowMetric>
    total: number
}

export default function MetricBars({ entries, total }: MetricBarsProps) {
    return <div className='space-y-2'>
        {entries.map(entry => <Bar key={entry.key} label={entry.key}
            value={'count' in entry ? (entry.count || 0) : Math.round(entry.avg_time || 0)} total={total} />)}
    </div>
}
