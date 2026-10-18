import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from '@playwright/test'

type FixtureBundleOptions = {
    entrypoint: string
    directoryPrefix: string
    define: string
    executableEnvironment?: 'BUN_BIN' | 'BUN_BINARY'
    outputFilename?: string
}

export function registerFixtureBundle(options: FixtureBundleOptions) {
    let directory: string | undefined
    let bundle: string | undefined

    test.beforeAll(() => {
        directory = mkdtempSync(path.join(tmpdir(), options.directoryPrefix))
        const filename = options.outputFilename ?? 'fixture.js'
        const executable = options.executableEnvironment
            ? process.env[options.executableEnvironment] || 'bun'
            : 'bun'
        const entryName = filename.replace(/\.js$/, '')

        execFileSync(executable, [
            'build', options.entrypoint, '--target=browser', '--define', options.define,
            `--outdir=${directory}`, `--entry-naming=${entryName}.[ext]`,
        ])
        bundle = readFileSync(path.join(directory, filename), 'utf8')
    })

    test.afterAll(() => {
        if (directory) rmSync(directory, { recursive: true, force: true })
    })

    return {
        get bundle() {
            if (bundle === undefined) throw new Error('Fixture bundle was requested before it was built.')
            return bundle
        },
    }
}
