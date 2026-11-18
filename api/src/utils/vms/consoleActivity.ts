import { updateLocalLxdConfig } from './lxd.ts'

export function startVmConsoleActivity(name: string) {
    const touch = () => {
        void updateLocalLxdConfig(name, {
            'user.hanasand.console_active_until': String(Date.now() + 90_000),
        }).catch(() => {})
    }
    touch()
    const interval = setInterval(touch, 30_000)
    interval.unref()
    return () => clearInterval(interval)
}
