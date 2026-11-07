import type { SupabaseClient } from "@supabase/supabase-js";

export type PanelResult<T> =
  | { status: "ok"; rows: T[] }
  | { status: "error" };

export interface PanelLoaderContext {
  db: SupabaseClient;
  me: { id: string } | null;
  today: string;
}

