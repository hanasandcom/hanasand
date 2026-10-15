export const executableName = (value: string) => value.split(/[/\\]/).at(-1)?.replace(/\.exe$/i, '').toLowerCase() || ''
const shells = /^(?:ba|da|z|k|c|fi)?sh$/
const interpreters = /^(?:python[\d.]*|perl|ruby|php|node|pwsh|powershell)$/
export type Command = { args: string[], text: string, next?: string }
// Tokenize only to distinguish executed commands from quoted argument text. No
// shell expansion or code execution occurs; audit child events cover expansions.
function shellCommands(input: string, operators = true): Command[] {
    const commands: Command[] = []
    let args: string[] = [], word = '', quote = '', active = false, start = 0
    const flushWord = () => { if (active) args.push(word); word = ''; active = false }
    const flushCommand = (end: number, next?: string) => { flushWord(); if (args.length) commands.push({ args, text: input.slice(start, end), next }); args = []; start = end + 1 }
    for (let i = 0; i < input.length; i++) {
        const char = input[i]
        if (char === '\\' && quote !== '\'' && i + 1 < input.length) { word += input[++i]; active = true; continue }
        if (quote) { if (char === quote) quote = ''; else word += char; continue }
        if (char === '"' || char === '\'') { quote = char; active = true; continue }
        if (/\s/.test(char)) { flushWord(); continue }
        if (char === '#' && !active) { flushCommand(i); return commands }
        if (operators && ';|&'.includes(char)) { flushCommand(i, char); continue }
        word += char; active = true
    }
    flushCommand(input.length)
    return commands
}
// env lists variables only when no command operand remains. Consume option
// values before deciding; -S splits arguments, but does not run shell operators.
// Unsupported options do not prove a child invocation; its own audit execution
// still matches by executable, even when wrapper argument parsing is unavailable.
function envArguments(args: string[], depth = 0): string[] | null {
    if (depth > 4) return null
    let index = 0
    const split = (value: string) => envArguments([...shellCommands(value, false).flatMap(entry => entry.args), ...args.slice(index + 1)], depth + 1)
    for (; index < args.length && args[index].startsWith('-'); index++) {
        const option = args[index]
        if (option === '--' || option === '-') { index++; break }
        if (option.startsWith('--')) {
            const equal = option.indexOf('=')
            const name = equal < 0 ? option : option.slice(0, equal)
            if (['--unset', '--chdir', '--argv0', '--split-string', '--env0-from'].includes(name)) {
                const value = equal < 0 ? args[++index] : option.slice(equal + 1)
                if (value === undefined) return null
                if (name === '--split-string') return split(value)
            } else if (!['--ignore-environment', '--null', '--debug', '--default-signal', '--ignore-signal', '--block-signal', '--list-signal-handling'].includes(name)) return null
            continue
        }
        for (let at = 1; at < option.length; at++) {
            const flag = option[at]
            if ('uCaS'.includes(flag)) {
                const value = option.slice(at + 1) || args[++index]
                if (value === undefined) return null
                if (flag === 'S') return split(value)
                break
            }
            if (!'i0v'.includes(flag)) return null
        }
    }
    while (index < args.length && /^[^=]+=/.test(args[index])) index++
    return args.slice(index)
}
const sudoValueOptions = new Set(['C', 'D', 'g', 'p', 'R', 'T', 'u'])
const sudoFlagOptions = new Set(['A', 'B', 'E', 'H', 'K', 'k', 'n', 'P', 'S', 'V', 'v', 'b', 'e', 'i', 'l', 'N', 's'])
const sudoNoCommandOptions = new Set(['e', 'l', 'v', 'V', 'K'])
const sudoLongValueOptions = new Set(['--chdir', '--chroot', '--close-from', '--command-timeout', '--group', '--host', '--prompt', '--user'])
const sudoLongFlagOptions = new Set(['--askpass', '--background', '--bell', '--edit', '--help', '--login', '--no-update', '--non-interactive', '--preserve-groups', '--preserve-env', '--reset-timestamp', '--remove-timestamp', '--set-home', '--stdin', '--validate', '--version', '--list', '--shell'])
const sudoLongNoCommandOptions = new Set(['--edit', '--help', '--list', '--remove-timestamp', '--validate', '--version'])
function sudoCommandArguments(args: string[]): string[] | null {
    let index = 0
    while (index < args.length) {
        const option = args[index]
        if (/^[A-Za-z_]\w*=/.test(option)) { index++; continue }
        if (option === '--') { index++; break }
        if (option === '-' || !option.startsWith('-')) break
        if (option.startsWith('--')) {
            const equal = option.indexOf('=')
            const name = equal < 0 ? option : option.slice(0, equal)
            if (sudoLongValueOptions.has(name)) {
                const value = equal < 0 ? args[++index] : option.slice(equal + 1)
                if (!value || equal < 0 && value.startsWith('-')) return null
            } else if (sudoLongFlagOptions.has(name) && equal < 0) {
                if (sudoLongNoCommandOptions.has(name)) return null
                // No operand.
            } else if (name === '--preserve-env' && equal >= 0 && option.slice(equal + 1)) {
                // The long form has an optional value only when attached with '='.
            } else return null
            index++
            continue
        }
        for (let at = 1; at < option.length; at++) {
            const flag = option[at]
            if (sudoNoCommandOptions.has(flag)) return null
            if (flag === 'h') {
                // A bare -h is a host selector only when a host and command follow.
                if (option[at + 1] === '=') return null
                if (at === option.length - 1) {
                    const host = args[index + 1]
                    if (!host || host.startsWith('-') || /^[A-Za-z_]\w*=/.test(host) || index + 2 >= args.length) return null
                    index++
                }
                break
            }
            if (sudoValueOptions.has(flag)) {
                let value = option.slice(at + 1)
                if (value.startsWith('=')) return null
                if (!value) {
                    value = args[++index] || ''
                    if (!value || value.startsWith('-')) return null
                }
                break
            }
            if (!sudoFlagOptions.has(flag)) return null
        }
        index++
    }
    return index < args.length ? args.slice(index) : null
}
export function executionContexts(executable: string, command: string, argv: unknown) {
    const commands: Command[] = []
    const supplied = Array.isArray(argv) && argv.length && argv.every(value => typeof value === 'string') ? argv as string[] : null
    const executables = new Set(executable && (executableName(executable) !== 'env' || (!supplied && !command.trim())) ? [executable] : [])
    const inspect = (entry: Command, depth = 0) => {
        if (!entry.args.length || depth > 4) return
        const name = executableName(entry.args[0])
        if (name === 'env') {
            const child = envArguments(entry.args.slice(1))
            if (child?.length) inspect({ ...entry, args: child, text: child.join(' ') }, depth + 1)
            else if (child) executables.add(entry.args[0])
            return
        }
        if (name === 'sudo') {
            const child = sudoCommandArguments(entry.args.slice(1))
            if (child) inspect({ ...entry, args: child, text: child.join(' ') }, depth + 1)
            return
        }
        if (shells.test(name)) {
            const flag = entry.args.findIndex(arg => /^-[^-]*c$/.test(arg))
            if (flag > 0 && entry.args[flag + 1]) {
                for (const nested of shellCommands(entry.args[flag + 1])) inspect(nested, depth + 1)
                return
            }
            const script = entry.args.slice(1).find(arg => !arg.startsWith('-'))
            if (script) executables.add(script)
        } else if (interpreters.test(name)) {
            // A script operand identifies the tool; strings passed to -c/-e are
            // behavior evidence, never treated as executable paths.
            if (!entry.args.some(arg => ['-c', '-e', '-m', '-command', '-encodedcommand', '-enc'].includes(arg.toLowerCase()))) {
                const script = entry.args.slice(1).find(arg => !arg.startsWith('-'))
                if (script) executables.add(script)
            }
        }
        executables.add(entry.args[0])
        commands.push(entry)
    }
    if (supplied) inspect({ args: supplied, text: command || supplied.join(' ') })
    else for (const entry of shellCommands(command)) inspect(entry)
    return { commands, executables }
}
