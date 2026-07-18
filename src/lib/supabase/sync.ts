import type { AppState } from "@/lib/types";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export type SnapshotPayload = Pick<
  AppState,
  | "profile"
  | "plan"
  | "messages"
  | "sessions"
  | "mealLogs"
  | "metrics"
  | "subscription"
  | "activeWorkoutId"
  | "lastOpenDate"
  | "dailyLlmCount"
  | "dailyLlmDate"
>;

/** Salva snapshot no Supabase se logado. No-op sem config/sessão. */
export async function pushSnapshot(payload: SnapshotPayload): Promise<boolean> {
  const supabase = createSupabaseBrowser();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // strip heavy images from old messages
  const safe: SnapshotPayload = {
    ...payload,
    messages: (payload.messages || []).slice(-200).map((m, i, arr) =>
      m.imageDataUrl && i < arr.length - 5
        ? { ...m, imageDataUrl: undefined }
        : m
    ),
    sessions: (payload.sessions || []).slice(-120),
    mealLogs: (payload.mealLogs || []).slice(-300),
    metrics: (payload.metrics || []).slice(-200),
  };

  const { error } = await supabase.from("app_snapshots").upsert({
    user_id: user.id,
    payload: safe,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("[sync] push failed", error.message);
    return false;
  }
  return true;
}

export async function pullSnapshot(): Promise<SnapshotPayload | null> {
  const supabase = createSupabaseBrowser();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_snapshots")
    .select("payload")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.payload) return null;
  return data.payload as SnapshotPayload;
}

export async function getAuthUser() {
  const supabase = createSupabaseBrowser();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
