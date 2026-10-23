import { VmPanel } from './vmPanel'
import { VmReconnectNotice } from './vmReconnectNotice'
import VMAccessActions from './vmAccessActions'
import { VMConnectInstructions } from './vmConnectInstructions'

type VMAccessProps = {
    vmName: string
    connection: VMConnectionDetails | null
    error?: string
}

export default function VMAccess({ vmName, connection, error }: VMAccessProps) {
    return (
        <VmPanel title='Access'>
            {connection ? (
                <div className='space-y-2 text-sm text-ui-text/72'>
                    <p>Connect with your saved SSH public keys. New VMs now inherit the certificates on your profile automatically.</p>
                    <div className='space-y-1 text-xs text-almostbright/80'>
                        <p><span className='font-semibold text-ui-text/70'>Username:</span> {connection.username}</p>
                        <p><span className='font-semibold text-ui-text/70'>Host:</span> {connection.vmIp || 'IP attaching'}</p>
                        <p><span className='font-semibold text-ui-text/70'>Profile SSH keys:</span> {connection.certificateCount}</p>
                    </div>
                    <VMConnectInstructions command={connection.sshCommand} />
                    {!connection.certificateCount && (
                        <p className='text-xs text-ui-warning/80'>
                            Add a certificate on your profile to enable passwordless terminal access from your own machine.
                        </p>
                    )}
                </div>
            ) : (
                <VmReconnectNotice
                    title={error ? 'Access details unavailable' : 'Access details reconnecting'}
                    message={error || 'Reloading SSH user, host, and certificate information automatically…'}
                />
            )}
            <div className='grid gap-3 border-t border-ui-border pt-3'>
                <div>
                    <h3 className='text-sm font-semibold text-ui-text'>VM sudo password</h3>
                    <p className='mt-1 text-xs leading-5 text-ui-muted'>Reauthenticate to view it. Each successful view is recorded and emailed to the VM owner.</p>
                </div>
                <VMAccessActions vmName={vmName} />
            </div>
        </VmPanel>
    )
}
