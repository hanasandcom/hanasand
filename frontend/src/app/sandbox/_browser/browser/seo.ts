export function buildRouteMetadata(input: { title: string; description: string; path: string; keywords?: string[] }) {
    return {
        title: `${input.title} | Hanasand`,
        description: input.description,
        keywords: input.keywords,
        alternates: { canonical: input.path },
        openGraph: { title: `${input.title} | Hanasand`, description: input.description, url: input.path, siteName: 'Hanasand', type: 'website' },
    }
}
