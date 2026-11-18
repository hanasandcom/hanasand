import type { VmGameServer } from '@/utils/vms/createOptions'

export default function VmGameServerDetails({ game }: { game: VmGameServer }) {
    return <div className='grid gap-1 rounded-lg border border-ui-border bg-ui-panel px-3 py-2.5 text-sm text-ui-muted'>
        <p className='font-medium text-ui-text'>{game.label} server</p>
        <p>Ubuntu 24.04 · at least {game.minMemoryGiB} GB memory and {game.minDiskGiB} GB disk · game ports {game.ports.map(port => `${port.port} ${port.protocol.toUpperCase()}`).join(', ')}.</p>
        <p>The server starts in the VM after setup. Configure public access before inviting players.</p>
        {game.id === 'game-cs2' && <p>A Steam game server token is needed for public server listing.</p>}
        {game.id === 'game-valheim' && <p>After setup, run <code className='text-ui-text'>sudo cat /opt/hanasand-game/valheim-password</code> in the VM terminal to view the server password.</p>}
        {game.id === 'game-valheim' && <p>Steam players can connect using the public address. Xbox and Game Pass crossplay is not enabled.</p>}
    </div>
}
