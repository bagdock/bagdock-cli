/**
 * Agent Protocol — Structured output for TTY and non-TTY environments.
 *
 * Non-TTY (piped, CI/CD, AI agents): JSON to stdout, errors to stderr.
 * TTY (interactive): Human-friendly colored output.
 *
 * Global flags: --json (force JSON), --quiet / -q (suppress status, implies --json)
 */

import chalk from 'chalk'

let forceJson = false
let quiet = false

export function setOutputMode(opts: { json?: boolean; quiet?: boolean }) {
  quiet = !!opts.quiet
  forceJson = !!opts.json || !!opts.quiet
}

export function isJsonMode(): boolean {
  return forceJson || !process.stdout.isTTY
}

export function isQuiet(): boolean {
  return quiet
}

export function outputSuccess(data: unknown) {
  if (isJsonMode()) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  }
}

export function outputError(code: string, message: string, details?: unknown) {
  if (isJsonMode()) {
    const err: Record<string, unknown> = { error: { code, message } }
    if (details) (err.error as Record<string, unknown>).details = details
    process.stderr.write(JSON.stringify(err) + '\n')
    process.exit(1)
  } else {
    console.error(chalk.red(`Error [${code}]:`), message)
    if (details) console.error(details)
    process.exit(1)
  }
}

export function outputList(objectType: string, data: unknown[], hasMore: boolean) {
  if (isJsonMode()) {
    process.stdout.write(JSON.stringify({ object: 'list', data, has_more: hasMore }, null, 2) + '\n')
  }
}

export function status(message: string) {
  if (!isQuiet() && !isJsonMode()) {
    console.log(chalk.dim(message))
  }
}

export function success(message: string) {
  if (!isQuiet() && !isJsonMode()) {
    console.log(chalk.green(message))
  }
}
