import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'aria-label' | 'children' | 'className'> & {
    label: string
    children: ReactNode
}

const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton({ label, children, ...buttonProps }, ref) {
    return (
        <button
            type='button'
            aria-label={label}
            {...buttonProps}
            ref={ref}
            className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ui-muted hover:bg-ui-raised focus-visible:outline-ui-primary'
        >
            {children}
        </button>
    )
})

export default IconButton
