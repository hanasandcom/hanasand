import type { ComponentProps } from 'react'

export type SidebarProps = ComponentProps<'aside'>

export function Sidebar({ 'aria-label': ariaLabel = 'Application sidebar', ...props }: SidebarProps) {
    return <aside aria-label={ariaLabel} {...props} />
}
