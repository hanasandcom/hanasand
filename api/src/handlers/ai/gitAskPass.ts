import { chmod, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const gitAskPassScript = `#!/bin/sh
case "$1" in
  *Username*) printf '%s' "x-access-token" ;;
  *Password*) printf '%s' "$HANASAND_GITHUB_TOKEN" ;;
  *) printf '%s' "" ;;
esac
`

export async function createGitAskPass(directory: string, fileName: string) {
    await mkdir(directory, { recursive: true })
    const scriptPath = path.join(directory, fileName)
    await writeFile(scriptPath, gitAskPassScript, 'utf8')
    await chmod(scriptPath, 0o700)
    return scriptPath
}
