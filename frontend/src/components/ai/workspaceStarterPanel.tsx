import { Panel, WorkspacePrimaryAction } from './workbenchPaneDisplay'
import { useState } from 'react'
import { Rocket } from 'lucide-react'

export function WorkspaceStarterPanel({ onScaffoldStarter }: { onScaffoldStarter: (template: 'nextjs_docker', projectName?: string | null) => void | Promise<void> }) {
    const [starterName, setStarterName] = useState('')
    return (<>
        <Panel
            icon={<Rocket className='h-4 w-4' />}
            title='Starter'
            subtitle='Create a Docker-ready Next.js workspace.'
        >
            <input value={starterName} onChange={(event) => setStarterName(event.target.value)} placeholder='Project name' className='rounded-lg bg-ui-panel px-3 py-2 text-sm text-ui-text outline outline-ui-border placeholder:text-ui-muted' />
            <WorkspacePrimaryAction onClick={() => onScaffoldStarter('nextjs_docker', starterName)} hover>
                Create workspace
            </WorkspacePrimaryAction>
        </Panel>

    </>)
}
