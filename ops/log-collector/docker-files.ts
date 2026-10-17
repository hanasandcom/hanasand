import * as fs from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { MAX_RECORD_BYTES } from './event-data';
import { CollectionError } from './delivery';

export interface DockerSource { name: string; path: string; since: string }
export interface Cursor { device: number; inode: number; offset: number; anchor?: string }
export interface LogFile { rank: number; path: string; stat: fs.Stats }

export function dockerJsonFiles(source: DockerSource): LogFile[] {
  const parent = dirname(source.path), prefix = basename(source.path); if (!fs.existsSync(parent)) return [];
  const result: LogFile[] = [];
  for (const name of fs.readdirSync(parent)) {
    if (!name.startsWith(prefix)) continue;
    const suffix = name.slice(prefix.length), match = suffix.match(/^\.(\d+)(?:\.gz)?$/); if (suffix && !match) continue;
    const path = join(parent, name);
    try { const stat = fs.statSync(path); if (stat.isFile()) result.push({ rank: match ? Number(match[1]) : 0, path, stat }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return result.sort((a, b) => b.rank - a.rank);
}

// Buffered reads keep Docker JSON history scans bounded without a syscall per byte.
export class FileLines {
  position: number; buffer = Buffer.alloc(0); index = 0;
  constructor(public fd: number, offset: number) { this.position = offset; }
  next(): Buffer {
    const parts: Buffer[] = []; let size = 0;
    while (size <= MAX_RECORD_BYTES) {
      if (this.index === this.buffer.length) {
        const chunk = Buffer.alloc(65536), count = fs.readSync(this.fd, chunk, 0, chunk.length, this.position);
        this.buffer = chunk.subarray(0, count); this.index = 0; if (!count) break;
      }
      const newline = this.buffer.indexOf(10, this.index), end = newline < 0 ? this.buffer.length : newline + 1;
      const part = this.buffer.subarray(this.index, end); parts.push(part); size += part.length; this.position += part.length; this.index = end;
      if (newline >= 0) break;
    }
    if (size > MAX_RECORD_BYTES) throw new CollectionError('JSON log record exceeds 8MB; cursor retained');
    return Buffer.concat(parts, size);
  }
}
