export function LogTimestamp({ value }: { value: string }) {
    return <time suppressHydrationWarning dateTime={value}>{new Date(value).toLocaleString()}</time>
}
