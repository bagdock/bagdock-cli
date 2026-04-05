/**
 * `bagdock switch` — Select which operator and environment (live/sandbox)
 * to target for subsequent commands.
 *
 * Saves the chosen operator slug + environment to the active profile.
 *
 * Interactive: lists operators, prompts selection, then lists environments.
 * Non-interactive (CI/CD): requires --operator and --env flags.
 */

import chalk from 'chalk'
import { updateProfileContext, type BagdockEnvironment } from './config'
import { apiFetch } from './api'
import { isJsonMode, outputSuccess, outputError, status } from './output'

interface Operator {
  id: string
  slug: string
  name: string
  tier?: string
  sandbox_active?: boolean
}

interface Sandbox {
  id: string
  slug: string
  name: string
  status: string
  is_default: boolean
}

async function fetchOperators(): Promise<Operator[]> {
  const res = await apiFetch('/api/v1/me/operators')
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as any
    throw new Error(err?.error?.message || `API returned ${res.status}`)
  }
  const body = await res.json() as { data: Operator[] }
  return body.data ?? []
}

async function fetchSandboxes(): Promise<Sandbox[]> {
  const res = await apiFetch('/api/v1/me/sandboxes')
  if (!res.ok) return []
  const body = await res.json() as { data: Sandbox[] }
  return body.data ?? []
}

function prompt(question: string): Promise<string> {
  const readline = require('readline')
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer: string) => {
    rl.close()
    resolve(answer.trim())
  }))
}

export async function switchContext(opts: { operator?: string; env?: string }) {
  status('Fetching your operators...')

  let operators: Operator[]
  try {
    operators = await fetchOperators()
  } catch (err: any) {
    outputError('api_error', `Failed to list operators: ${err.message}`)
    return
  }

  if (!operators.length) {
    outputError('no_operators', 'No operators found for your account.')
    return
  }

  let selected: Operator

  if (opts.operator) {
    const match = operators.find(o => o.slug === opts.operator || o.id === opts.operator)
    if (!match) {
      outputError('not_found', `Operator "${opts.operator}" not found. Available: ${operators.map(o => o.slug).join(', ')}`)
      return
    }
    selected = match
  } else if (operators.length === 1) {
    selected = operators[0]
    if (!isJsonMode()) {
      console.log(chalk.dim(`  Auto-selected: ${selected.name} (${selected.slug})`))
    }
  } else if (!process.stdout.isTTY || isJsonMode()) {
    outputError('operator_required', `Multiple operators available. Pass --operator <slug>. Available: ${operators.map(o => o.slug).join(', ')}`)
    return
  } else {
    console.log(chalk.bold('\n  Select operator:\n'))
    operators.forEach((op, i) => {
      console.log(`    ${chalk.cyan(String(i + 1))} ${op.name} ${chalk.dim(`(${op.slug})`)}`)
    })
    console.log()
    const answer = await prompt('  > ')
    const idx = parseInt(answer, 10) - 1
    if (isNaN(idx) || idx < 0 || idx >= operators.length) {
      outputError('invalid_selection', 'Invalid selection.')
      return
    }
    selected = operators[idx]
  }

  // Resolve environment
  let environment: BagdockEnvironment = 'live'

  if (opts.env) {
    if (opts.env !== 'live' && opts.env !== 'test') {
      outputError('invalid_env', 'Environment must be "live" or "test".')
      return
    }
    environment = opts.env as BagdockEnvironment
  } else if (process.stdout.isTTY && !isJsonMode()) {
    // Fetch sandboxes to show available test environments
    status('Fetching sandboxes...')

    // Temporarily save operator context so the sandboxes fetch uses the right operator
    updateProfileContext(selected.id, selected.slug, 'live')

    const sandboxes = await fetchSandboxes()

    console.log(chalk.bold('\n  Select environment:\n'))
    console.log(`    ${chalk.cyan('1')} Live`)

    if (sandboxes.length > 0) {
      sandboxes.forEach((sb, i) => {
        const tag = sb.is_default ? chalk.dim(' (default)') : ''
        console.log(`    ${chalk.cyan(String(i + 2))} Sandbox: ${sb.name}${tag}`)
      })
    } else {
      console.log(`    ${chalk.cyan('2')} Test ${chalk.dim('(default sandbox)')}`)
    }
    console.log()

    const envAnswer = await prompt('  > ')
    const envIdx = parseInt(envAnswer, 10)

    if (envIdx === 1) {
      environment = 'live'
    } else if (sandboxes.length > 0 && envIdx >= 2 && envIdx <= sandboxes.length + 1) {
      environment = 'test'
    } else if (envIdx === 2 && sandboxes.length === 0) {
      environment = 'test'
    } else {
      outputError('invalid_selection', 'Invalid selection.')
      return
    }
  }

  // Save context
  updateProfileContext(selected.id, selected.slug, environment)

  if (isJsonMode()) {
    outputSuccess({
      operator: { id: selected.id, slug: selected.slug, name: selected.name },
      environment,
    })
  } else {
    const envLabel = environment === 'test' ? chalk.yellow('test') : chalk.green('live')
    console.log()
    console.log(chalk.green('  Switched to'), chalk.bold(selected.name), chalk.dim(`(${selected.slug})`), `[${envLabel}]`)
    console.log()
  }
}
