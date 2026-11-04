/**
 * Files an owner-action issue when a merged pull request changed something
 * only the owner can put live: core migrations, vault migrations or vault
 * Edge Functions. Run by .github/workflows/owner-actions.yml through
 * actions/github-script; see rules/issues.md.
 *
 * It cannot tell whether the owner has already applied anything: CI never
 * holds database credentials, the vault's least of all. A pull request whose
 * changes were applied before it merged (every S1/S2 fix, rules/disclosure.md
 * §4) carries the `already-applied` label, and is skipped.
 *
 * The issue says what to apply and where, never why: the "why" is the pull
 * request, which follows rules/disclosure.md itself.
 */

export const SKIP_LABEL = 'already-applied'
export const DEFAULT_ASSIGNEE = 'Nitinsudarshan'

export const LABELS = {
  'owner-action': { color: 'd93f0b', description: 'Only a person with the right seat can do it' },
  migration: { color: '5319e7', description: 'SQL to apply to one or more projects' },
}

const CORE_MIGRATION = /^supabase\/migrations\/[^/]+\.sql$/
const VAULT_MIGRATION = /^supabase\/vault\/migrations\/[^/]+\.sql$/
const VAULT_FUNCTION = /^supabase\/vault\/functions\/([^/]+)\/[^/]+$/

/** Marks the issue for one pull request, so a re-run never files a second. */
export const marker = (prNumber) => `<!-- owner-actions:pr-${prNumber} -->`

/**
 * Sorts a pull request's changed files into what has to be put live.
 * Deleted files need nothing applied. Functions are named by their folder;
 * a change to `_shared` means every function must be redeployed.
 */
export function ownerActionFiles(files) {
  const core = []
  const vault = []
  const functions = new Set()
  let shared = false

  for (const f of files) {
    if (f.status === 'removed') continue
    const edited = f.status === 'modified' || f.status === 'changed'
    if (CORE_MIGRATION.test(f.filename)) core.push({ path: f.filename, edited })
    else if (VAULT_MIGRATION.test(f.filename)) vault.push({ path: f.filename, edited })
    else {
      const m = VAULT_FUNCTION.exec(f.filename)
      if (m) {
        if (m[1] === '_shared') shared = true
        else functions.add(m[1])
      }
    }
  }

  const byPath = (a, b) => a.path.localeCompare(b.path)
  return {
    core: core.sort(byPath),
    vault: vault.sort(byPath),
    functions: [...functions].sort(),
    shared,
  }
}

export const hasWork = (g) => g.core.length > 0 || g.vault.length > 0 || g.functions.length > 0 || g.shared

const fileName = (p) => p.split('/').pop()
const editedNote = (f) =>
  f.edited ? ' (an existing file was edited: check with the author before re-running it)' : ''

/** The issue to file, or null when the pull request changed nothing to apply. */
export function buildIssue({ prNumber, groups }) {
  if (!hasWork(groups)) return null

  const parts = []
  if (groups.core.length) parts.push(`${groups.core.length} core migration${groups.core.length > 1 ? 's' : ''}`)
  if (groups.vault.length) parts.push(`${groups.vault.length} vault migration${groups.vault.length > 1 ? 's' : ''}`)
  if (groups.functions.length || groups.shared) parts.push('vault functions')

  const lines = [
    marker(prNumber),
    `#${prNumber} merged, and the app has already deployed it. Apply what it changed.`,
    'If its description gives an order (a migration before the code, say), do that step first.',
    '',
  ]

  if (groups.core.length) {
    lines.push(
      '### Core migrations',
      "In the production core project's SQL editor, in this order:",
      ...groups.core.map((f) => `- [ ] \`${f.path}\`${editedNote(f)}`),
      '',
      'Each file names its own checks in its header. All are safe to re-run.',
      ''
    )
  }

  if (groups.vault.length) {
    lines.push(
      '### Vault migrations',
      'From your machine, vault-dev first (`docs/vault-setup.md` §2):',
      ...groups.vault.map((f) => `- [ ] \`${fileName(f.path)}\` on **vault-dev**${editedNote(f)}`),
      ...groups.vault.map((f) => `- [ ] \`${fileName(f.path)}\` on **vault**`),
      '- [ ] Both zero-row checks in `docs/vault-setup.md` §2, on each vault',
      ''
    )
  }

  if (groups.functions.length || groups.shared) {
    const which = groups.shared
      ? 'All of them: shared code changed.'
      : `Changed: ${groups.functions.map((f) => `\`${f}\``).join(', ')}.`
    lines.push(
      '### Vault functions',
      `${which} Deploy with \`scripts/vault-deploy.sh\`, dev first. Keep the existing secret unless you mean to change it.`,
      '- [ ] vault-dev',
      '- [ ] vault',
      ''
    )
  }

  lines.push(
    'Close this issue once every box is ticked.',
    '',
    `<sub>Filed by \`.github/workflows/owner-actions.yml\` (\`rules/issues.md\`). A pull request applied before it merges is labelled \`${SKIP_LABEL}\` and files nothing.</sub>`
  )

  return {
    title: `Apply #${prNumber} to production: ${parts.join(', ')}`,
    body: lines.join('\n'),
    labels: groups.core.length || groups.vault.length ? ['owner-action', 'migration'] : ['owner-action'],
  }
}

/** Entry point for actions/github-script. */
export async function run({ github, context, core, assignee = process.env.OWNER_ACTION_ASSIGNEE || DEFAULT_ASSIGNEE }) {
  const pr = context.payload.pull_request
  const { owner, repo } = context.repo

  if (!pr?.merged) return core.info('Not a merged pull request.')
  if ((pr.labels ?? []).some((l) => l.name === SKIP_LABEL)) {
    return core.info(`#${pr.number} is labelled ${SKIP_LABEL}; nothing to file.`)
  }

  const files = await github.paginate(github.rest.pulls.listFiles, {
    owner,
    repo,
    pull_number: pr.number,
    per_page: 100,
  })
  const issue = buildIssue({ prNumber: pr.number, groups: ownerActionFiles(files) })
  if (!issue) return core.info(`#${pr.number} changed nothing that needs applying.`)

  const existing = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    labels: 'owner-action',
    state: 'all',
    per_page: 100,
  })
  const filed = existing.find((i) => (i.body ?? '').includes(marker(pr.number)))
  if (filed) return core.info(`Already filed as #${filed.number}.`)

  for (const name of issue.labels) {
    try {
      await github.rest.issues.createLabel({ owner, repo, name, ...LABELS[name] })
    } catch (e) {
      if (e.status !== 422) throw e // 422: it exists already
    }
  }

  let created
  try {
    created = await github.rest.issues.create({ owner, repo, ...issue, assignees: [assignee] })
  } catch (e) {
    // 422 when the assignee is no longer a collaborator. File it anyway:
    // an unassigned owner action is better than none.
    if (e.status !== 422) throw e
    core.warning(`Could not assign ${assignee}; filing unassigned.`)
    created = await github.rest.issues.create({
      owner,
      repo,
      ...issue,
      body: `${issue.body}\n\n**Not assigned:** ${assignee} could not be assigned automatically.`,
    })
  }
  core.info(`Filed #${created.data.number}.`)
  return created.data.number
}
