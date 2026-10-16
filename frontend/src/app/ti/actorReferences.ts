export type ActorReference = { name: string; author: string; year: string; url?: string }
export const actorReferenceMetadata: Record<string, Omit<ActorReference, 'name'>> = {
    'white house imposing costs ru gov april 2021': { author: 'The White House', year: '2021', url: 'https://www.whitehouse.gov/briefing-room/statements-releases/2021/04/15/fact-sheet-imposing-costs-for-harmful-foreign-activities-by-the-russian-government/' },
    'uk gov malign ris activity april 2021': { author: 'UK Government', year: '2021', url: 'https://www.gov.uk/government/news/uk-and-us-expose-global-campaign-of-malicious-cyber-activity-by-russian-intelligence-services' },
    'f-secure the dukes': { author: 'F-Secure', year: '2015', url: 'https://www.f-secure.com/documents/996508/1030745/dukes_whitepaper.pdf' },
    'grizzly steppe jar': { author: 'U.S. Department of Homeland Security & FBI', year: '2017', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa17-110a' },
    'crowdstrike dnc june 2016': { author: 'CrowdStrike', year: '2016', url: 'https://www.crowdstrike.com/blog/bears-midst-intrusion-democratic-national-committee/' },
    'uk gov uk exposes russia solarwinds april 2021': { author: 'UK Government', year: '2021', url: 'https://www.gov.uk/government/news/uk-and-us-expose-global-campaign-of-malicious-cyber-activity-by-russian-intelligence-services' },
    'nsa joint advisory svr solarwinds april 2021': { author: 'NSA & CISA', year: '2021', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-008a' },
    'uk nscs russia solarwinds april 2021': { author: 'UK National Cyber Security Centre', year: '2021', url: 'https://www.gov.uk/government/news/uk-and-us-expose-global-campaign-of-malicious-cyber-activity-by-russian-intelligence-services' },
    'fireeye sunburst backdoor december 2020': { author: 'FireEye', year: '2020', url: 'https://www.mandiant.com/resources/blog/evasive-attacker-leverages-solarwinds-sunburst-backdoor' },
    'mstic nobelium mar 2021': { author: 'Microsoft Threat Intelligence Center', year: '2021', url: 'https://www.microsoft.com/en-us/security/blog/2021/03/04/new-solarwinds-related-threat-activity/' },
    'crowdstrike sunspot implant january 2021': { author: 'CrowdStrike', year: '2021', url: 'https://www.crowdstrike.com/blog/sunspot-malware-technical-analysis/' },
    'volexity solarwinds': { author: 'Volexity', year: '2020', url: 'https://www.volexity.com/blog/2020/12/13/novel-attack-chain-targets-us-government-agencies/' },
    'cybersecurity advisory svr ttp may 2021': { author: 'CISA', year: '2021', url: 'https://www.cisa.gov/news-events/cybersecurity-advisories/aa21-116a' },
    'unit 42 solarstorm december 2020': { author: 'Unit 42, Palo Alto Networks', year: '2020', url: 'https://unit42.paloaltonetworks.com/solarstorm-supernova/' }
}
export function citationNames(description: string) {
    const citationPattern = new RegExp('\\(Citation:\\s*([^)]+)\\)', 'g')
    const citations: string[] = []
    description.replace(citationPattern, (_match, rawName: string) => {
        const name = rawName.trim()
        if (!name) return _match
        const existing = citations.indexOf(name)
        if (existing < 0) citations.push(name)
        return _match
    })
    return citations
}
