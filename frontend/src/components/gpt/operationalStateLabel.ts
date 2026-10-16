export function operationalStateLabel(value: string) {
    if (value === 'blocked') return 'syncing'
    if (value === 'needs_action' || value === 'action_required') return 'reviewing'
    return value.replaceAll('_', ' ')
}
