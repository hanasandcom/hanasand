export type PublicActorContext = {
    source: 'public-ti'
    sessionLocal: true
    query: string
    generatedAt: string
}

export type SelectedPublicActorContext = PublicActorContext & {
    selectedItemId: string
    title: string
}
