// What a request may set on a location, checked before it reaches the
// database. Only these fields; anything else in the body (an id, a
// created_at) is dropped.
import { LOCATION_STATUSES, LOCATION_TYPES, type UpdateLocationInput } from './types';

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const STATE_CODE = /^[A-Z]{2}$/;

export function parseLocationFields(body: Record<string, unknown>, opts: { requireName: boolean }): Parsed<UpdateLocationInput> {
  const out: UpdateLocationInput = {};

  if ('name' in body || opts.requireName) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return { ok: false, error: 'Location name is required.' };
    if (name.length > 255) return { ok: false, error: 'Location name is too long.' };
    out.name = name;
  }
  if ('type' in body) {
    if (!LOCATION_TYPES.includes(body.type as never)) return { ok: false, error: 'Unknown location type.' };
    out.type = body.type as UpdateLocationInput['type'];
  }
  if ('status' in body) {
    if (!LOCATION_STATUSES.includes(body.status as never)) return { ok: false, error: 'Status must be active or closed.' };
    out.status = body.status as UpdateLocationInput['status'];
  }
  if ('address' in body) {
    if (body.address !== null && typeof body.address !== 'string') return { ok: false, error: 'Address must be text.' };
    out.address = typeof body.address === 'string' && body.address.trim() ? body.address.trim() : null;
  }
  if ('state_code' in body) {
    const code = body.state_code;
    if (code === null || code === '') out.state_code = null;
    else if (typeof code === 'string' && STATE_CODE.test(code)) out.state_code = code;
    else return { ok: false, error: 'Pick a state from the list.' };
  }
  return { ok: true, value: out };
}
