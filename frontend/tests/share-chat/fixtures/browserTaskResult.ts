type BrowserTaskResultOptions = {
    url?: string
    title: string
    textExcerpt?: string
    headings: string[]
    links: Array<{ text: string, href?: string }>
    buttons: string[]
    inputs?: string[]
    forms?: string[]
    screenshotPath?: string | null
    consoleMessages?: string[]
    pageErrors?: string[]
}

export function browserTaskResult({
    url,
    title,
    textExcerpt,
    headings,
    links,
    buttons,
    inputs = [],
    forms = [],
    screenshotPath = null,
    consoleMessages = ['Fetched browser target without executing client-side JavaScript.'],
    pageErrors = [],
}: BrowserTaskResultOptions) {
    return {
        url,
        title,
        ...(textExcerpt === undefined ? {} : { textExcerpt }),
        structure: { headings, links, buttons, inputs, forms, hasViewportMeta: true },
        screenshotPath,
        consoleMessages,
        pageErrors,
    }
}
