import type { HostConsoleName } from './hostSshTransport.ts'

export function isHostConsoleAvailable(name: string): name is HostConsoleName {
    return name === 'ovh'
}
