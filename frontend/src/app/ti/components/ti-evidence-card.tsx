import type { ComponentProps } from 'react'

const CARD_CLASSES = 'rounded-md border border-ui-border bg-ui-panel p-2 dark:border-ui-border dark:bg-ui-panel'

type TiEvidenceCardProps = ComponentProps<'div'>

export default function TiEvidenceCard({ className, ...props }: TiEvidenceCardProps) {
    return <div {...props} className={className ? `${CARD_CLASSES} ${className}` : CARD_CLASSES} />
}
