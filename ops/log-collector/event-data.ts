import * as fs from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Metadata = { [key: string]: Json };
export interface Config { host: string; start?: string; url?: string; token?: string; guestCollection?: boolean }
export interface LogEvent { sourceEventId: string; service: string; host: string; message: string; timestamp: string; level: string; metadata: Metadata }
export type AtomicEventGroup = { events: LogEvent[]; atomic: true };
export type Events = Iterable<LogEvent | AtomicEventGroup> | AsyncIterable<LogEvent | AtomicEventGroup>;
export const MAX_RECORD_BYTES = 8 * 1024 * 1024;
export const BATCH_BYTES = 256 * 1024;
export const BATCH_COUNT = 100;
export const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const iso = (value = Date.now() / 1000) => {
  const micros = Math.round(value * 1e6), whole = Math.floor(micros / 1e6), fraction = micros - whole * 1e6;
  return new Date(whole * 1000).toISOString().replace('.000Z', (fraction ? '.' + String(fraction).padStart(6, '0') : '') + '+00:00');
};
export const seconds = (value: string) => {
  const match = value.match(/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/);
  const result = match ? Date.parse(match[1] + match[3]) / 1000 + Number('0.' + (match[2] || '0').slice(0, 6)) : Date.parse(value) / 1000;
  if (!Number.isFinite(result)) throw new Error('Invalid timestamp');
  return result;
};
export const jsonSize = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
const chars = (text: string, count: number) => Array.from(text).slice(0, count).join('');
export function scrub(text: string): string {
  if (!/bearer|basic|password|passwd|token|secret|cookie|authorization|api|https?:\/\/|curl|sshpass|mysql|mariadb|redis-cli/i.test(text)) return text;
  text = text.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9+/_.=-]+/gi, '$1 [REDACTED]')
    .replace(/(["'](?:set-cookie|cookie|authorization)\s*:\s*)([^"'\r\n]*)(["'])/gi, '$1[REDACTED]$3')
    .replace(/^(\s*(?:set-cookie|cookie|authorization)\s*:\s*)[^\r\n]*/gi, '$1[REDACTED]')
    .replace(/(\b(?:authorization|proxy-authorization)\s*[:=]\s*)(?:bearer\s+|basic\s+)?[^\s'"]+/gi, '$1[REDACTED]')
    .replace(/((?:--[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie)[\w-]*\s+)|(?:\b[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie)[\w-]*["']?\s*[=:]\s*))("[^"\r\n]*"|'[^'\r\n]*'|[^\s&;,"']+)/gi, '$1[REDACTED]');
  for (const [program, flag] of [['curl', '(?:-u|-U|--user|--proxy-user|--oauth2-bearer)'], ['sshpass', '-p'], ['(?:mysql|mariadb)', '-p'], ['redis-cli', '-a']]) {
    text = text.replace(new RegExp("(\\b" + program + "\\b[^;\\r\\n|]*?\\s" + flag + "(?:=|\\s+))(\"[^\"\\r\\n]*\"|'[^'\\r\\n]*'|[^\\s;|]+)", 'gi'), '$1[REDACTED]');
  }
  for (const [program, flag] of [['curl', '(?:-u|-U)'], ['(?:sshpass|mysql|mariadb)', '-p'], ['redis-cli', '-a']]) {
    text = text.replace(new RegExp('(\\b' + program + '\\b[^;\\r\\n|]*?\\s' + flag + ')([^\\s;|]+)', 'g'), '$1[REDACTED]');
  }
  return text.replace(/(https?:\/\/)[^/@\s:]+:[^/@\s]+@/g, '$1[REDACTED]@');
}
export function scrubArguments(args: string[]): string[] {
  const flags: Record<string, string[]> = { curl: ['-u', '-U', '--user', '--proxy-user', '--oauth2-bearer'], sshpass: ['-p'], mysql: ['-p'], mariadb: ['-p'], 'redis-cli': ['-a'] };
  const short = flags[basename(args[0] || '')] || [];
  let hide = false;
  return args.map(arg => {
    if (hide) { hide = false; return '[REDACTED]'; }
    const attached = short.find(flag => flag.length === 2 && arg.startsWith(flag) && arg.length > 2);
    const assigned = short.find(flag => arg.startsWith(flag + '='));
    hide = short.includes(arg) || /^--?[\w-]*(?:password|passwd|token|secret|api[_-]?key|cookie|authorization)[\w-]*$/i.test(arg);
    return attached ? attached + '[REDACTED]' : assigned ? assigned + '=[REDACTED]' : scrub(arg);
  });
}
export function scrubMetadata(value: Json): Json {
  if (Array.isArray(value)) return value.map(scrubMetadata);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key,
    /password|token|secret|cookie|authorization|api[_-]?key/i.test(key) ? '[REDACTED]' :
      key === 'arguments' && Array.isArray(item) && item.every(arg => typeof arg === 'string') ? scrubArguments(item as string[]) : scrubMetadata(item)]));
  return typeof value === 'string' ? scrub(value) : value;
}
export function fitText(value: string, budget: number): string {
  if (jsonSize(value) <= budget) return value;
  const points = Array.from(value); let low = 0, high = points.length;
  while (low < high) { const middle = Math.ceil((low + high) / 2); if (jsonSize(points.slice(0, middle).join('')) <= budget) low = middle; else high = middle - 1; }
  return points.slice(0, low).join('');
}
function compact(value: Json, depth = 0, field = ''): Json {
  if (typeof value === 'string') return fitText(value, ['command_line', 'command'].includes(field) ? 65536 : 4096);
  if (Array.isArray(value)) {
    const result: Json[] = [];
    for (const item of value.slice(0, field === 'arguments' ? 512 : 16)) {
      const next = compact(item, depth + 1);
      if (jsonSize([...result, next]) > (field === 'arguments' ? 65536 : 16384)) break;
      result.push(next);
    }
    return result;
  }
  if (value && typeof value === 'object') {
    if (depth > 4) return { truncated: true };
    const priority = ['process', 'executable', 'command_line', 'command', 'arguments', 'user', 'event_type', 'action', 'outcome', 'collector', 'physical_host', 'vm', 'structured'];
    const keys = [...priority.filter(key => key in value), ...Object.keys(value).filter(key => !priority.includes(key))];
    const result: Metadata = {};
    for (const key of keys.slice(0, 32)) { const item = compact(value[key], depth + 1, key); if (jsonSize({ ...result, [key]: item }) <= 170000) result[key] = item; }
    return result;
  }
  return value;
}
export function boundedMetadata(value: Metadata): Metadata {
  const clean = scrubMetadata(value) as Metadata, size = jsonSize(clean);
  return size <= 230000 ? clean : { ...compact(clean) as Metadata, telemetry_truncated: true, metadata_original_bytes: size, metadata_preview: fitText(JSON.stringify(clean), 32000) };
}
export function event(config: Config, sourceId: string, service: string, message: string, timestamp: string, metadata: Metadata = {}, level = 'info'): LogEvent {
  return { sourceEventId: sha(config.host + ':' + sourceId), service: chars(service, 256), host: config.host, message: chars(scrub(message), 65536) || '(empty)', timestamp, level, metadata: boundedMetadata(metadata) };
}
export function syncDirectory(path: string) { const fd = fs.openSync(path, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); } }
