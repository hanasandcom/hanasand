import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import git, { LOCAL_REPO_PATH } from './git.ts'

const execFileAsync = promisify(execFile)

export default async function commitAndPush(message: string) {
    await git('add .')
    if (!(await git('diff --cached --name-only'))) return
    await git(`commit -m '${message}'`)
    const pushUrl = process.env.ARTICLES_REPO_PUSH_URL
    if (!pushUrl) {
        console.warn('Article saved locally; set ARTICLES_REPO_PUSH_URL to publish it to GitHub.')
        return
    }

    try {
        await execFileAsync('git', ['-C', LOCAL_REPO_PATH, 'push', pushUrl, 'HEAD:main'], {
            timeout: 60000,
            env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        })
    } catch {
        throw new Error('Article was saved locally, but publishing to the article repository failed.')
    }
}
