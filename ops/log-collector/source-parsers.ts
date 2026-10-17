import { fs } from './runtime';
import { Config, LogEvent, Metadata, event, scrub, scrubArguments, iso, MAX_RECORD_BYTES } from './event-data';
import { matchingExecution, type ExecutionLookup } from './executions';
import { markReadinessContext } from './readinessAttestation';

const trimEnding = (text: string) => text.replace(/\n$/, '').replace(/\r$/, '');
export const shellQuote = (value: string) => value === '' ? "''" : /^[\w@%+=:,./-]+$/.test(value) ? value : "'" + value.replaceAll("'", "'\"'\"'") + "'";
export function auditArg(value: string): string {
  if (value.startsWith('"')) return value.slice(1, -1);
  return /^(?:[0-9a-f]{2})+$/i.test(value) ? Buffer.from(value, 'hex').toString('utf8') : value;
}
export function parseAudit(text: string, config: Config, receipts: ExecutionLookup = []): LogEvent[] {
  const groups = new Map<string, string[]>(), events: LogEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const row = line.split('\x1d', 1)[0]; if (!/^type=(SYSCALL|EXECVE|PATH|PROCTITLE) /.test(row)) continue;
    const identity = row.match(/msg=audit\((\d+(?:\.\d+)?):(\d+)\)/)?.[0];
    if (identity) { if (!groups.has(identity)) groups.set(identity, []); groups.get(identity)!.push(row); }
  }
  for (const [identity, rows] of groups) {
    const syscall = rows.find(row => row.startsWith('type=SYSCALL ')); if (!syscall) continue;
    const attrs = Object.fromEntries([...syscall.matchAll(/\b(\w+)=((?:"[^"]*")|\S+)/g)].map(match => [match[1], match[2]]));
    const args = new Map<number, string>(), parts = new Map<number, Map<number, string>>();
    for (const row of rows.filter(row => row.startsWith('type=EXECVE '))) for (const match of row.matchAll(/\ba(\d+)(?:\[(\d+)\])?=((?:"[^"]*")|\S+)/g)) {
      const key = Number(match[1]);
      if (match[2] !== undefined) { if (!parts.has(key)) parts.set(key, new Map()); parts.get(key)!.set(Number(match[2]), auditArg(match[3])); }
      else args.set(key, auditArg(match[3]));
    }
    for (const [key, chunks] of parts) args.set(key, [...chunks].sort((a, b) => a[0] - b[0]).map(pair => pair[1]).join(''));
    const attemptedPath = rows.filter(row => row.startsWith('type=PATH ')).map(row => row.match(/\bname=((?:"[^"]*")|\S+)/)?.[1]).filter((value): value is string => Boolean(value))
      .map(auditArg).find(value => value !== '(null)');
    const hasArguments = args.size > 0;
    if (!hasArguments && attrs.success === 'yes') continue;
    let argv = hasArguments ? [...args].sort((a, b) => a[0] - b[0]).map(pair => pair[1]) : [];
    const executable = hasArguments ? auditArg(attrs.exe || '"' + argv[0] + '"') : attemptedPath || auditArg(attrs.exe || '"unknown"');
    argv = scrubArguments(argv);
    const command = scrub(hasArguments ? argv.map(shellQuote).join(' ') : 'failed exec: ' + executable), match = identity.match(/\((\d+(?:\.\d+)?):(\d+)\)/)!;
    const execution = matchingExecution(attrs, argv, Number(match[1]) * 1000, receipts);
    const log = event(config, 'audit:' + identity, 'audit', command, iso(Number(match[1])), {
      collector: 'auditd', event_type: 'process', action: 'exec', outcome: attrs.success === 'yes' ? 'success' : 'failure',
      process: { executable, command_line: command, arguments: argv, pid: attrs.pid ?? null, parent_pid: attrs.ppid ?? null,
        ...(!hasArguments && attrs.exe ? { caller_executable: auditArg(attrs.exe) } : {}) },
      user: { id: attrs.uid ?? null, login_id: attrs.auid ?? null }, audit_id: match[2],
      ...(execution ? { collector_execution: { ...execution } } : {}),
    });
    markReadinessContext(log, attrs, rows);
    events.push(log);
  }
  return events;
}
export async function* auditEvents(lines: AsyncIterable<string>, config: Config, receipts: ExecutionLookup = []) {
  let identity: string | undefined, rows: string[] = [], size = 0;
  for await (const line of lines) {
    if (!/^type=(SYSCALL|EXECVE|PATH|PROCTITLE) /.test(line)) continue;
    const current = line.match(/msg=audit\((\d+(?:\.\d+)?):(\d+)\)/)?.[0]; if (!current) continue;
    if (identity && current !== identity) { yield* parseAudit(rows.join(''), config, receipts); rows = []; size = 0; }
    identity = current; size += Buffer.byteLength(line); if (size > MAX_RECORD_BYTES) throw new Error('Audit event exceeds 8MB; cursor retained'); rows.push(line);
  }
  if (rows.length) yield* parseAudit(rows.join(''), config, receipts);
}
export function localAuditDate(timestamp: number): string[] {
  const d = new Date(timestamp * 1000), pad = (n: number) => String(n).padStart(2, '0');
  return [pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + pad(d.getFullYear() % 100), pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())];
}
export function checkpointTime(path: string): number | null {
  if (!fs.existsSync(path)) return null;
  const match = fs.readFileSync(path, 'utf8').match(/^output=.*?\s(\d+(?:\.\d+)?):\d+/m); return match ? Number(match[1]) : null;
}
export function dockerEvent(config: Config, id: string, name: string, timestamp: string, message: string, stream?: string): LogEvent {
  const metadata: Metadata = { collector: 'docker', container_id: id }; if (stream) metadata.stream = stream;
  let level = 'info';
  try {
    const structured = JSON.parse(message);
    if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
      let raw = structured.level;
      if (typeof raw === 'string') { raw = raw.trim().toLowerCase(); raw = ({ warning: 'warn', critical: 'fatal' } as Record<string, string>)[raw] || raw; }
      level = typeof raw === 'number' ? ({ 10: 'debug', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' } as Record<number, string>)[raw] || 'info' : ['debug', 'info', 'warn', 'error', 'fatal'].includes(raw) ? raw : 'info';
      metadata.structured = structured;
    }
  } catch { if (/\b(error|exception|failed|failure|fatal|panic)\b/i.test(message)) level = 'error'; }
  return event(config, 'docker:' + id + ':' + timestamp + ':' + message, name, message, timestamp, metadata, level);
}
export async function* dockerCliStream(config: Config, id: string, name: string, lines: AsyncIterable<string>): AsyncGenerator<LogEvent> {
  let timestamp: string | undefined, parts: string[] = [], size = 0;
  for await (const line of lines) {
    const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})) /);
    if (match) {
      if (timestamp) yield dockerEvent(config, id, name, timestamp, trimEnding(parts.join('')));
      timestamp = match[1]; parts = [line.slice(match[0].length)]; size = Buffer.byteLength(parts[0]);
    } else if (timestamp) { parts.push(line); size += Buffer.byteLength(line); }
    if (size > MAX_RECORD_BYTES) throw new Error('Docker event exceeds 8MB; cursor retained');
  }
  if (timestamp) yield dockerEvent(config, id, name, timestamp, trimEnding(parts.join('')));
}
