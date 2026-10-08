import { createHash } from 'node:crypto';
import { join } from 'node:path';

const identityPrefix = /^(\d{20})-/;
const queuedFile = /^\d{20}-.+\.(?:json|pending|pending\.interrupted)$/;

export function queueBucket(name: string): string {
  const match = identityPrefix.exec(name);
  if (!match) throw new Error('Invalid queue filename');
  const timestamp = Number(BigInt(match[1]) / 1_000_000n);
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid queue timestamp');
  const hour = date.toISOString().slice(0, 13).replace(/[-T]/g, '');
  const shard = createHash('sha256').update(name).digest('hex')[0];
  return `${hour}-${shard}`;
}

export function isQueueFile(name: string): boolean {
  return queuedFile.test(name);
}

export function shardedQueuePath(current: string, name: string): string {
  return join(current, queueBucket(name), name);
}

export function isQueueBucket(name: string): boolean {
  return /^\d{10}-[0-9a-f]$/.test(name);
}
