import { describe, it, expect } from 'vitest'
import { ALL_ROLES } from './roles'
import { renderMatrix, readMatrixFromDoc, writeMatrix } from '../../../scripts/rbac-matrix.mjs'

/**
 * Keeps docs/rbac.md and roles.ts from drifting.
 *
 * The source document's own change process is "update the doc first, then the
 * code" — which only works if something checks. This is that check.
 *
 * Regenerate with `npm run rbac:matrix` after changing a role.
 */
describe('docs/rbac.md', () => {
  const rendered = renderMatrix(ALL_ROLES)

  if (process.env.UPDATE_DOCS === '1') {
    it('is rewritten from the role definitions', () => {
      writeMatrix(rendered)
      expect(readMatrixFromDoc()).toBe(rendered)
    })
    return
  }

  it('matches the role definitions', () => {
    expect(readMatrixFromDoc()).toBe(rendered)
  })
})
