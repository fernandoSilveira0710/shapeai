import type { AppState } from "@/lib/types";

export async function tryVisionMeal(
  imageDataUrl: string,
  s: Pick<AppState, "profile" | "plan" | "subscription">,
  caption?: string
): Promise<string | null> {
  if (s.subscription !== "pro" || !s.profile) return null;
  try {
    const planSummary = s.plan
      ? `~${s.plan.nutrition.kcal} kcal, P${s.plan.nutrition.proteinG}g · refeições: ${s.plan.nutrition.meals
          .map((m) => `${m.title}: ${m.items[0]}`)
          .join(" | ")}`
      : "";

    const res = await fetch("/api/vision/meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageDataUrl,
        tone: s.profile.tone,
        planSummary,
        caption,
      }),
      signal: AbortSignal.timeout(25_000),
    });
    const data = (await res.json()) as { text?: string | null };
    if (typeof data.text === "string" && data.text.trim()) return data.text.trim();
    return null;
  } catch {
    return null;
  }
}
