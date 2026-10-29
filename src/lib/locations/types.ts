export type LocationType = 'Campus' | 'Bootcamp' | 'Day Center';
export type LocationStatus = 'active' | 'closed';

export const LOCATION_TYPES: LocationType[] = ['Campus', 'Bootcamp', 'Day Center'];
export const LOCATION_STATUSES: LocationStatus[] = ['active', 'closed'];

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  address?: string | null;
  /** ISO 3166-2:IN code from `indian_states`; null until someone sets it. */
  state_code?: string | null;
  status: LocationStatus;
  created_at: string;
}

/** A row of `indian_states`. */
export interface IndianState {
  code: string;
  name: string;
  kind: 'state' | 'union_territory';
  aliases: string[];
}

export interface CreateLocationInput {
  name: string;
  type?: LocationType;
  address?: string | null;
  state_code?: string | null;
  status?: LocationStatus;
}

export interface UpdateLocationInput {
  name?: string;
  type?: LocationType;
  address?: string | null;
  state_code?: string | null;
  status?: LocationStatus;
}
