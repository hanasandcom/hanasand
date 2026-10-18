import SheetEditor, { type SheetEditorProps } from './sheetEditor'
import PlanSheet from './planSheet'
import TimetableSheet from './timetableSheet'
import type { ActivityLog } from './timetableData'

type Props = SheetEditorProps & {
    onActivityLogChange?: (log: ActivityLog) => boolean
}

export default function SheetView(props: Props) {
    const { id, name } = props.sheet
    const sheetName = name?.toLowerCase()
    if (id === 'Timetable' || sheetName === 'timetable') return <TimetableSheet {...props} />
    if (id === 'Plan' || sheetName === 'plan') return <PlanSheet {...props} />
    return <SheetEditor {...props} />
}
