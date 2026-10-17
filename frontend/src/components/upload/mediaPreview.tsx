type MediaPreviewProps = {
    src: string
}

type ImagePreviewProps = MediaPreviewProps & {
    kind: 'image'
    alt: string
    className: string
    loading?: 'eager' | 'lazy'
}

type VideoPreviewProps = MediaPreviewProps & {
    kind: 'video'
    className: string
    preload?: 'none' | 'metadata' | 'auto'
}

export default function MediaPreview(props: ImagePreviewProps | VideoPreviewProps) {
    if (props.kind === 'image') return <img src={props.src} alt={props.alt} loading={props.loading} className={props.className} />
    return <video src={props.src} controls preload={props.preload} className={props.className} />
}
