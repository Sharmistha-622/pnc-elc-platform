// Core vouches for a submission with a shared secret in `x-core-signature`.
// The vault never trusts a core role, only this narrow, signed assertion.
// These functions are deployed with --no-verify-jwt, so this check is the gate.

export function callerIsCore(req: Request): boolean {
  const presented = req.headers.get('x-core-signature')
  const expected = Deno.env.get('CORE_SUBMISSION_SECRET')
  if (!presented || !expected) return false
  // Constant-time compare; a length mismatch is already a mismatch.
  if (presented.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < presented.length; i++) diff |= presented.charCodeAt(i) ^ expected.charCodeAt(i)
  return diff === 0
}
