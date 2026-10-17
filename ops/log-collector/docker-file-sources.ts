import { fs, join } from './runtime';
import { Config, LogEvent, Metadata, event, iso, seconds, sha, MAX_RECORD_BYTES, BATCH_BYTES } from './event-data';
import { CollectionError, collectionError } from './delivery';
import { SystemSources } from './system-sources';
import { dockerEvent } from './source-parsers';
import { DockerSource, Cursor, FileLines, dockerJsonFiles } from './docker-files';

export class DockerFileSources extends SystemSources {
  async registerDockerFile(id: string, name: string, since: string) {
    try {
      const details = JSON.parse(await this.commands.run(['docker', 'inspect', '--format', '{"path":{{json .LogPath}},"driver":{{json .HostConfig.LogConfig.Type}}}', id], { timeout: 15 }));
      if (details.driver !== 'json-file' || !fs.statSync(details.path).isFile()) return false;
      fs.accessSync(details.path, fs.constants.R_OK);
      const source: DockerSource = { name, path: details.path, since }; if (dockerJsonFiles(source).some(file => file.path.endsWith('.gz'))) return false;
      const sources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}); sources[id] = source; this.store.save('docker-file-sources.json', sources); return true;
    } catch { return false; }
  }
  async retireDockerFile(config: Config, id: string, source: DockerSource) {
    const retired = this.store.load<Metadata>('docker-file-retired.json', {}), cursors: Metadata = {};
    for (const kind of ['history', 'live']) {
      const name = 'docker-file-' + kind + '-' + id + '.json', cursor = this.store.load<Metadata | null>(name, null);
      if (cursor) cursors[kind] = { checkpoint: cursor, last_ack_at: iso(fs.statSync(this.store.path(name)).mtimeMs / 1000) };
    }
    const entry: Metadata = { source: { ...source }, retired_at: iso(), final_coverage: 'unknown', cursors };
    await this.store.send([event(config, 'docker-source-retired:' + id, 'host-log-collector', source.name + ': container removed; final log coverage is unknown because source files are unavailable', entry.retired_at as string,
      { collector: 'docker', container_id: id, source_status: 'removed_source_unavailable', retired_source: entry }, 'error')]);
    retired[id] = entry; this.store.save('docker-file-retired.json', retired);
    const sources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}); delete sources[id]; this.store.save('docker-file-sources.json', sources);
  }
  async dockerCreatedAt(id: string) {
    const created = this.store.load<Record<string, string>>('docker-created.json', {});
    if (!created[id]) {
      try { const timestamp = (await this.commands.run(['docker', 'inspect', '--format', '{{.Created}}', id], { timeout: 15 })).trim(); seconds(timestamp); created[id] = timestamp; this.store.save('docker-created.json', created); }
      catch { return null; }
    }
    return created[id];
  }
  async notice(config: Config, id: string, source: DockerSource, cursor: Cursor, reason: string) {
    const identity = 'docker-file-notice:' + id + ':' + cursor.inode + ':' + cursor.offset + ':' + (cursor.anchor || '') + ':' + reason;
    await this.store.send([event(config, identity, 'host-log-collector', source.name + ': ' + reason, iso(), { collector: 'docker', container_id: id, source_status: reason }, 'error')]);
  }
  async dockerFileBatch(config: Config, id: string, source: DockerSource, live = false): Promise<number> {
    const stateName = 'docker-file-' + (live ? 'live-' : 'history-') + id + '.json';
    let cursor = this.store.load<Cursor | null>(stateName, null);
    const files = dockerJsonFiles(source); if (!files.length) throw new CollectionError(source.name + ' (source files unavailable)');
    let selected = files.find(file => cursor && file.stat.ino === cursor.inode && file.stat.dev === cursor.device);
    if (cursor && !selected) { await this.notice(config, id, source, cursor, 'previous source file unavailable; replaying retained history'); cursor = null; }
    selected ??= live ? files[files.length - 1] : files[0];
    const { rank, path, stat } = selected;
    if (path.endsWith('.gz')) throw new CollectionError(source.name + ' (compressed history requires CLI recovery; file cursor preserved)');
    let offset = cursor?.offset ?? 0;
    if (cursor && stat.size < offset) { await this.notice(config, id, source, cursor, 'source file truncated; replaying available contents'); offset = 0; }
    const fd = fs.openSync(path, 'r'); let complete = offset, anchor = Buffer.alloc(0), eof = false;
    const events: LogEvent[] = [];
    try {
      const actual = fs.fstatSync(fd); if (actual.dev !== stat.dev || actual.ino !== stat.ino) throw new CollectionError(source.name + ' (source rotated during open; retrying)');
      if (live && !cursor) {
        const base = Math.max(0, stat.size - MAX_RECORD_BYTES), tail = Buffer.alloc(stat.size - base);
        const count = fs.readSync(fd, tail, 0, tail.length, base), last = tail.subarray(0, count).lastIndexOf(10); offset = last < 0 ? 0 : base + last + 1;
      }
      anchor = Buffer.alloc(Math.min(offset, 128)); fs.readSync(fd, anchor, 0, anchor.length, Math.max(0, offset - 128));
      if (cursor?.anchor && offset === cursor.offset && sha(anchor) !== cursor.anchor) { await this.notice(config, id, source, cursor, 'source file rewritten or truncated; replaying available contents'); offset = 0; anchor = Buffer.alloc(0); }
      const reader = new FileLines(fd, offset), started = performance.now(), cutoff = seconds(source.since); let scanned = 0, eventBytes = 0; complete = offset;
      while (scanned < MAX_RECORD_BYTES && events.length < 100 && eventBytes < BATCH_BYTES && performance.now() - started < 100) {
        const line = reader.next(); if (!line.length) { eof = true; break; }
        if (line[line.length - 1] !== 10) {
          if (rank > 0) {
            const digest = sha(line);
            events.push(event(config, 'docker-fragment:' + id + ':' + stat.ino + ':' + complete + ':' + digest, source.name, line.toString('utf8'), iso(), {
              collector: 'docker', container_id: id, event_type: 'source_fragment', source_fragment: { reason: 'incomplete_rotated_record', inode: String(stat.ino), offset: complete, byte_length: line.length, sha256: digest, file_modified_at: iso(stat.mtimeMs / 1000), encoding: 'utf8-replacement', preview_truncated: line.length > 65536 },
            }, 'error'));
            complete = reader.position; anchor = Buffer.concat([anchor, line]).subarray(-128); eof = true;
          }
          break;
        }
        let timestamp: string, message: string, stream: string, time: number;
        try {
          const record = JSON.parse(line.toString('utf8'));
          if (typeof record.log !== 'string' || !['stdout', 'stderr'].includes(record.stream) || typeof record.time !== 'string') throw new Error();
          const match = record.time.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/); if (!match) throw new Error();
          time = seconds(record.time); timestamp = match[1] + '.' + (match[2] || '').padEnd(9, '0') + match[3]; message = lineEnding(record.log); stream = record.stream;
        } catch {
          const digest = sha(line), badOffset = complete;
          events.push(event(config, 'docker-invalid-record:' + id + ':' + stat.ino + ':' + badOffset + ':' + digest,
            'host-log-collector', source.name + ': malformed Docker JSON record skipped at byte ' + badOffset + ' (sha256=' + digest + ')',
            iso(stat.mtimeMs / 1000), { collector: 'docker', container_id: id, source_status: 'invalid_json_record_skipped',
              source_fragment: { reason: 'invalid_json_record', inode: String(stat.ino), offset: badOffset, byte_length: line.length, sha256: digest } }, 'error'));
          scanned += line.length; complete = reader.position; anchor = Buffer.concat([anchor, line]).subarray(-128);
          continue;
        }
        if (time >= cutoff) { const item = dockerEvent(config, id, source.name, timestamp, message, stream); events.push(item); eventBytes += Buffer.byteLength(JSON.stringify(item)); }
        scanned += line.length; complete = reader.position; anchor = Buffer.concat([anchor, line]).subarray(-128);
      }
    } finally { fs.closeSync(fd); }
    await this.store.send(events);
    let next: Cursor = { device: stat.dev, inode: stat.ino, offset: complete, anchor: sha(anchor) };
    const index = files.indexOf(selected);
    if (eof && index + 1 < files.length) { const nextStat = files[index + 1].stat; next = { device: nextStat.dev, inode: nextStat.ino, offset: 0 }; }
    if (JSON.stringify(next) !== JSON.stringify(cursor)) this.store.save(stateName, next);
    return Math.max(0, stat.size - complete) + files.slice(index + 1).reduce((sum, file) => sum + file.stat.size, 0);
  }
  async dockerFileSource(config: Config, live = false) {
    const sources = this.store.load<Record<string, DockerSource>>('docker-file-sources.json', {}), failures: string[] = []; let remaining = 0;
    for (const [id, source] of Object.entries(sources)) {
      try { remaining += await this.dockerFileBatch(config, id, source, live); } catch (error) { failures.push(error instanceof CollectionError ? error.message : source.name + ' (' + collectionError(error) + ')'); }
    }
    if (failures.length) throw new CollectionError(failures.join('; '));
    return { sources: Object.keys(sources).length, pendingFileBytes: remaining, retiredUnavailableSources: Object.keys(this.store.load('docker-file-retired.json', {})).length };
  }
}

function lineEnding(text: string) { return text.replace(/\n$/, '').replace(/\r$/, ''); }
