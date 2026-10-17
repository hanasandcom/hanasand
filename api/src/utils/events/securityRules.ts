// Match process telemetry, never free-text mentions in application messages.
import { executableName, executionContexts } from './securityCommandParsing.ts'
import { securityBehaviorRules } from './securityBehaviorRules.ts'

export type SecurityRule = { id: string, name: string, family: string, severity: 'low' | 'medium' | 'high' | 'critical', explanation: string, pattern: string, field: 'executable' | 'command', positive: string, negative: string }
type ReconnaissanceRuleEntry = [tool: string, severity: SecurityRule['severity'], explanation?: string]

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const reconnaissanceRule = ([tool, severity, explanation]: ReconnaissanceRuleEntry): SecurityRule => ({
    id: `process.recon.${tool}.v1`,
    name: `${tool} reconnaissance`,
    family: 'Reconnaissance',
    severity,
    explanation: explanation ?? `The ${tool} command was executed. Review the user and surrounding activity; legitimate administration can also trigger this rule.`,
    pattern: String.raw`(?:^|[/\\])${escapeRegex(tool)}(?:\.exe)?$`,
    field: 'executable',
    positive: `/usr/bin/${tool}`,
    negative: '/usr/bin/echo'
})

type SecurityToolRuleEntry = readonly [id: string, executable: string]

const securityToolRule = ([id, executable]: SecurityToolRuleEntry): SecurityRule => ({
    id: `process.tool.${id}.v1`,
    name: `${executable} execution`,
    family: 'Security tooling',
    severity: 'critical',
    explanation: `Execution of ${executable} requires review for authorized security testing or malicious activity.`,
    pattern: String.raw`(?:^|[/\\])${escapeRegex(executable)}(?:\.py|\.exe)?$`,
    field: 'executable',
    positive: `/opt/${executable}`,
    negative: '/usr/bin/echo'
})

const securityToolRules: SecurityToolRuleEntry[] = [
    ['xmrig', 'xmrig'],
    ['xmr_stak', 'xmr-stak'],
    ['minerd', 'minerd'],
    ['cpuminer', 'cpuminer'],
    ['kinsing', 'kinsing'],
    ['kdevtmpfsi', 'kdevtmpfsi'],
    ['masscan', 'masscan'],
    ['nmap', 'nmap'],
    ['rustscan', 'rustscan'],
    ['zmap', 'zmap'],
    ['nikto', 'nikto'],
    ['sqlmap', 'sqlmap'],
    ['hydra', 'hydra'],
    ['medusa', 'medusa'],
    ['john', 'john'],
    ['hashcat', 'hashcat'],
    ['mimikatz', 'mimikatz'],
    ['secretsdump', 'secretsdump'],
    ['pypykatz', 'pypykatz'],
    ['bloodhound', 'bloodhound'],
    ['sharphound', 'sharpHound'],
    ['bloodhound_python', 'bloodhound-python'],
    ['crackmapexec', 'crackmapexec'],
    ['netexec', 'netexec'],
    ['evil_winrm', 'evil-winrm'],
    ['responder', 'responder'],
    ['ntlmrelayx', 'ntlmrelayx'],
    ['mitm6', 'mitm6'],
    ['kerbrute', 'kerbrute'],
    ['rubeus', 'rubeus'],
    ['certipy', 'certipy'],
    ['certutil', 'certutil'],
    ['chisel', 'chisel'],
    ['ligolo_ng', 'ligolo-ng'],
    ['frpc', 'frpc'],
    ['ngrok', 'ngrok'],
    ['socat', 'socat'],
    ['msfconsole', 'msfconsole'],
    ['msfvenom', 'msfvenom'],
    ['sliver_client', 'sliver-client'],
    ['cobaltstrike', 'cobaltstrike'],
    ['linpeas', 'linpeas'],
    ['winpeas', 'winpeas'],
    ['linux_exploit_suggester', 'linux-exploit-suggester'],
    ['enum4linux', 'enum4linux'],
    ['smbclient', 'smbclient'],
    ['rpcclient', 'rpcclient'],
    ['impacket_psexec', 'impacket-psexec'],
    ['impacket_wmiexec', 'impacket-wmiexec'],
]

const reconnaissanceRules: ReconnaissanceRuleEntry[] = [
    ['whoami', 'high'],
    ['id', 'low'],
    ['hostname', 'high'],
    ['uname', 'low'],
    ['uptime', 'high'],
    ['w', 'high'],
    ['who', 'high'],
    ['last', 'high'],
    ['lastlog', 'high'],
    ['groups', 'high'],
    ['getent', 'high'],
    ['env', 'high', 'The env command listed environment variables without launching another program. Review the user and surrounding activity; legitimate administration can also trigger this rule.'],
    ['printenv', 'high'],
    ['ps', 'low'],
    ['pstree', 'high'],
    ['top', 'high'],
    ['ss', 'high'],
    ['netstat', 'high'],
    ['lsof', 'high'],
    ['ip', 'high'],
    ['ifconfig', 'high'],
    ['route', 'high'],
    ['arp', 'high'],
    ['nslookup', 'high'],
    ['dig', 'high'],
    ['host', 'low'],
    ['traceroute', 'high'],
    ['tracepath', 'high'],
    ['systeminfo', 'high'],
    ['tasklist', 'high'],
    ['quser', 'high'],
    ['qwinsta', 'high'],
    ['nltest', 'high'],
    ['dsquery', 'high'],
    ['net', 'high'],
]

export const securityRules: SecurityRule[] = [
    ...reconnaissanceRules.map(reconnaissanceRule),
    ...securityToolRules.map(securityToolRule),
    ...securityBehaviorRules,
]

const expressions = new Map(securityRules.map(rule => [rule.id, new RegExp(rule.pattern, 'i')]))
const behaviorPrograms: Record<string, RegExp> = {
    tool_download: /^(curl|wget|invoke-webrequest|iwr)$/,
    pipe_shell: /^(curl|wget)$/,
    reverse_shell: /^(?:ba|z|k)?sh$|^(?:nc|ncat|netcat|python[\d.]*|perl|ruby|php)$/,
    shadow_read: /^(cat|head|tail|cp|scp|tar)$/,
    history_clear: /^(history|rm|truncate|histfile=)/,
    logs_clear: /^(rm|truncate|shred)$/,
    audit_disable: /^(auditctl|systemctl|service)$/,
    firewall_disable: /^(ufw|iptables|nft)$/,
    suid_set: /^chmod$/,
    authorized_keys: /^(tee|cp|mv|sed|echo|printf)$/,
    cron_write: /^(crontab|tee|cp|mv)$/,
    base64_exec: /^(powershell|pwsh|base64)$/,
    credential_dump: /^(reg|rundll32)$/,
    docker_socket: /^(curl|docker)$/,
}

export function matchSecurityRules(event: Record<string, unknown>) {
    const process = event.process && typeof event.process === 'object' ? event.process as Record<string, unknown> : {}
    if (event.event_type !== 'process' || event.action !== 'exec') return []
    const command = typeof process.command_line === 'string' ? process.command_line.slice(0, 65536) : ''
    const executable = typeof process.executable === 'string' ? process.executable : ''
    const context = executionContexts(executable, command, process.arguments)
    return securityRules.filter(rule => {
        const expression = expressions.get(rule.id)!
        if (rule.field === 'executable') return [...context.executables].some(path => expression.test(path.replace(/\.sh$/i, '')))
        const behavior = rule.id.split('.')[2]
        return context.commands.some((entry, index) => {
            const name = executableName(entry.args[0])
            if (!behaviorPrograms[behavior]?.test(name)) return false
            if (behavior === 'pipe_shell') return entry.next === '|' && /^(?:sudo\s+)?(?:ba|z)?sh\b/.test(context.commands[index + 1]?.args.join(' ') || '')
            if (behavior === 'authorized_keys' && ['echo', 'printf'].includes(name)) {
                const unquoted = entry.text.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '')
                return />>?\s*[^\s]*authorized_keys/.test(unquoted)
            }
            // Preserve pipeline evidence for base64 decode followed by a shell.
            const text = entry.next === '|' ? `${entry.text} | ${context.commands[index + 1]?.text || ''}` : entry.text
            return expression.test(text)
        })
    })
}
