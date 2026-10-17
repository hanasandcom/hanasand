'use client'

import { displayRequirementList } from '../pageModel'

type Props = { items: string[], limit: number, spacing?: 'mt-1' | 'mt-2' | 'mt-3' }

export default function RequirementWarning({ items, limit, spacing = 'mt-1' }: Props) {
    if (!items.length) return null
    return <p className={`${spacing} wrap-break-word text-[11px] leading-5 text-ui-warning dark:text-ui-warning`}>{displayRequirementList(items.slice(0, limit))}</p>
}
