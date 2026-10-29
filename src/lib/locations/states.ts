// ============================================================================
// Locations — which state an address is in
// ----------------------------------------------------------------------------
// Pure, so the Locations screen can suggest a state as someone types an
// address. The rule is the one 202610291200_location_states.sql used to
// backfill existing locations: every state's name and aliases are looked for
// as whole words, and the one named LAST wins, since an Indian address ends
// "…, <state> <PIN>". "Madhya Pradesh Road, Hyderabad, Telangana" is
// Telangana. An address naming no state gives null.
// ============================================================================

import type { IndianState } from './types';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function stateFromAddress(address: string | null | undefined, states: IndianState[]): string | null {
  if (!address) return null;
  let best: { code: string; at: number } | null = null;
  for (const s of states) {
    for (const term of [s.name, ...s.aliases]) {
      if (!term) continue;
      const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'gi');
      for (const m of address.matchAll(re)) {
        const at = m.index ?? 0;
        if (!best || at > best.at) best = { code: s.code, at };
      }
    }
  }
  return best?.code ?? null;
}

/** "Maharashtra (MH)", or the bare code if the state list hasn't loaded. */
export function stateLabel(code: string | null | undefined, states: IndianState[]): string {
  if (!code) return '';
  const s = states.find((x) => x.code === code);
  return s ? `${s.name} (${s.code})` : code;
}
