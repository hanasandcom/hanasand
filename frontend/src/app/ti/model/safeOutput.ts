export function createTiSafeOutputMetadata() {
    return {
        metadataOnly: true,
        liveMutation: false,
        rawEvidenceExposed: false,
        webhookSecretExposed: false,
    } as const
}

export type TiSafeOutputMetadata = ReturnType<typeof createTiSafeOutputMetadata>
