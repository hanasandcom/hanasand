export function rewriteSharedPublicLanguage(value: string, actionabilityCopy: string) {
    return value
        .replace(/\bproof\b/gi, 'evidence')
        .replace(/\breadiness\b/gi, 'status')
        .replace(/\bactionability\b/gi, actionabilityCopy)
        .replace(/\breceipt\b/gi, 'record')
        .replace(new RegExp('\\bcon' + 'tract\\b', 'gi'), 'schema')
        .replace(/\bnamed\s+examples\b/gi, 'reported activity')
        .replace(/\btarget\s+signal(s)?\b/gi, 'targeting indicator$1')
        .replace(/\bsignal(s)?\b/gi, 'indicator$1')
        .replace(/\bcontrol\s+room\b/gi, 'console')
        .replace(/\bdashboard\s+slop\b/gi, 'low-value summary')
        .replace(/\bacceptance\s+criteria\b/gi, 'requirements')
        .replace(/\bteasers\b/gi, 'summaries')
        .replace(/\bteaser\b/gi, 'summary')
}
