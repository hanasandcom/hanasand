import { createHash } from 'node:crypto'
import { hostConsoleNames, runSshCommand, targetFor } from './hostSshTransport.ts'

const supportedKeyTypes = new Set([
    'ssh-ed25519',
    'ssh-rsa',
    'ecdsa-sha2-nistp256',
    'ecdsa-sha2-nistp384',
    'ecdsa-sha2-nistp521',
    'sk-ssh-ed25519@openssh.com',
    'sk-ecdsa-sha2-nistp256@openssh.com',
])

const managedKeysScript = [
    'import json, os, pathlib, sys, tempfile',
    'path = pathlib.Path.home() / ".ssh" / "authorized_keys"',
    'start = "# BEGIN Hanasand managed SSH keys"',
    'end = "# END Hanasand managed SSH keys"',
    'payload = json.loads(sys.stdin.read())',
    'keys = [line.strip() for line in payload.get("keys", []) if line.strip()]',
    'revoked = [line.strip() for line in payload.get("revoke", []) if line.strip()]',
    'if any("\\n" in key or "\\r" in key for key in keys + revoked): raise SystemExit("Invalid key line")',
    'supported = set(' + JSON.stringify([...supportedKeyTypes]) + ')',
    'def identity(line):',
    '    parts = line.strip().split()',
    '    for index, part in enumerate(parts[:-1]):',
    '        if part in supported: return part + " " + parts[index + 1]',
    '    return None',
    'path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)',
    'os.chmod(path.parent, 0o700)',
    'current = path.read_text() if path.exists() else ""',
    'if current.count(start) != current.count(end) or current.count(start) > 1: raise SystemExit("Managed key block is invalid")',
    'if start in current:',
    '    before = current[:current.index(start)]',
    '    end_at = current.index(end, current.index(start)) + len(end)',
    '    after = current[end_at:]',
    '    current = before + after',
    'elif end in current: raise SystemExit("Managed key block is invalid")',
    'revoked_ids = {identity(key) for key in revoked} - {None}',
    'if revoked_ids: current = "".join(line for line in current.splitlines(keepends=True) if identity(line) not in revoked_ids)',
    'if keys:',
    '    prefix = current.rstrip("\\n")',
    '    if prefix: prefix += "\\n\\n"',
    '    current = prefix + start + "\\n" + "\\n".join(keys) + "\\n" + end + "\\n"',
    'fd, temporary = tempfile.mkstemp(prefix=".authorized_keys.", dir=str(path.parent))',
    'try:',
    '    os.fchmod(fd, 0o600)',
    '    with os.fdopen(fd, "w") as output: output.write(current)',
    '    os.replace(temporary, path)',
    '    os.chmod(path, 0o600)',
    'finally:',
    '    if os.path.exists(temporary): os.unlink(temporary)',
].join('\n')

export function normalizeHostPublicKey(value: unknown) {
    if (typeof value !== 'string' || value.length > 16384 || /[\r\n]/.test(value)) return null
    const parts = value.trim().split(/\s+/)
    if (parts.length < 2 || !supportedKeyTypes.has(parts[0]) || !/^[A-Za-z0-9+/]+={0,2}$/.test(parts[1])) return null
    const blob = Buffer.from(parts[1], 'base64')
    if (!blob.length || blob.toString('base64').replace(/=+$/, '') !== parts[1].replace(/=+$/, '')) return null
    if (blob.length < 4) return null
    const typeLength = blob.readUInt32BE(0)
    if (typeLength > blob.length - 4 || blob.subarray(4, 4 + typeLength).toString() !== parts[0]) return null
    const comment = parts.slice(2).join(' ').trim()
    const publicKey = parts[0] + ' ' + parts[1] + (comment ? ' ' + comment : '')
    const fingerprint = 'SHA256:' + createHash('sha256').update(blob).digest('base64').replace(/=+$/, '')
    return { publicKey, fingerprint }
}

export function profileHostKeyReconciliationPlan(keys: string[], revoke: string[] = []) {
    return hostConsoleNames.map(host => ({ host, keys, revoke }))
}

export async function applyManagedHostSshKeys(keys: string[], revoke: string[] = []) {
    const encodedScript = Buffer.from(managedKeysScript).toString('base64')
    const command = `python3 -c "import base64;exec(base64.b64decode('${encodedScript}'))"`
    const results = await Promise.allSettled(profileHostKeyReconciliationPlan(keys, revoke).map(({ host, keys: hostKeys, revoke: hostRevoked }) =>
        runSshCommand(targetFor(host), command, JSON.stringify({ keys: hostKeys, revoke: hostRevoked }))))
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
}
