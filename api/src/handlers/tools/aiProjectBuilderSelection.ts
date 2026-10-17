import type { GeneratedProject } from './aiProjectBuilderTypes.ts'
import { botFiles } from './aiProjectBuilderBot.ts'
import { websiteFiles } from './aiProjectBuilderWebsite.ts'
import { workerFiles } from './aiProjectBuilderWorker.ts'
import { apiFiles } from './aiProjectBuilderApi.ts'
import { sectionsForPage } from './aiProjectBuilderSections.ts'
import { slugify } from './aiProjectBuilderText.ts'

export function chooseProject(prompt: string): GeneratedProject {
    const lower = prompt.toLowerCase()
    const title = titleFromPrompt(prompt)
    const slug = slugify(title)

    if (/\b(discord|bot|slack|telegram|server status bot|game server)\b/.test(lower)) {
        return botFiles(title, slug, lower.includes('discord') ? 'Discord' : 'Chat')
    }

    if (/\b(gallery|image review|photo|photographer)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(worker|queue|background|redis|job|transcode)\b/.test(lower) && !/\bwebsite|web site|page|frontend|landing\b/.test(lower)) {
        return workerFiles(title, slug, lower)
    }

    if (/\b(api|backend|fastify)\b/.test(lower) && !/\bpage|website|web site|site|frontend|landing|concept\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    if (/\b(page|website|web site|site|frontend|landing|concept)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(next\.?js|dockerized next|portable next|listing dashboard|knowledge base|portfolio|bakery|donor dashboard|investor update|artist shop|restaurant site)\b/.test(lower)) {
        return websiteFiles(title, slug, sectionsForPage(lower), lower)
    }

    if (/\b(api|backend|fastify|server|audit log|health|readiness|webhook|ledger|rate limit|idempoten|intake)\b/.test(lower) && !/\bwebsite|site|page|frontend|landing\b/.test(lower)) {
        return apiFiles(title, slug, lower)
    }

    return websiteFiles(title, slug, sectionsForPage(lower), lower)
}

function titleFromPrompt(prompt: string) {
    const quoted = /["']([^"']{3,80})["']/.exec(prompt)?.[1]
    if (quoted) {
        return quoted
    }

    const cleaned = prompt
        .replace(/\b(build|create|make|generate|scaffold|tiny|polished|runnable|dockerized|starter|for the current \/s project|critic|angry|demanding|user says|client says|please|fix|repair|rebuild)\b/gi, ' ')
        .replace(/\b(website|site|app|bot|api|dashboard|portal|tool|page|project|flow|service)\b/gi, ' ')
        .replace(/[^a-zA-Z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .slice(0, 5)
        .join(' ')

    return (cleaned || 'Hanasand Project').replace(/\w\S*/g, part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
}
