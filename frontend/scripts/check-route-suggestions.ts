import { suggestRoutes } from '../src/utils/routes/routeSuggestions'

const suggestion = suggestRoutes('/sandbx')

if (suggestion[0] !== '/sandbox') {
    throw new Error(`Expected /sandbox, got ${suggestion.join(', ')}`)
}

if (suggestion.length > 3) {
    throw new Error(`Expected at most three suggestions, got ${suggestion.length}`)
}

console.log('route suggestions ok')
