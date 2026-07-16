import type { AppState } from "@/lib/types";
import { planDayForDate } from "@/lib/plan-generator";
import { nowParts } from "@/lib/utils";

/**
 * Tenta resposta via LLM (/api/chat). Retorna null se não configurado,
 * timeout ou erro — o caller cai no rule-based.
 */
export async function tryLlmReply(
  message: string,
  s: Pick<AppState, "profile" | "plan" | "sessions" | "mealLogs" | "metrics" | "subscription">
): Promise<string | null> {
  if (!s.profile) return null;
  try {
    const { time, weekday } = nowParts();
    const day = s.plan ? planDayForDate(s.plan) : null;
    const lastWeight = s.metrics.filter((m) => m.kind === "weight").at(-1);
    const completed = s.sessions.filter((x) => x.status === "completed").length;

    const context = [
      `Nome: ${s.profile.displayName}`,
      `Agora: ${weekday}, ${time}`,
      `Objetivo: ${s.profile.goal} · ${s.profile.weightKg}kg · ${s.profile.heightCm}cm · ${s.profile.age} anos`,
      `Experiência: ${s.profile.experience} · treina ${s.profile.trainDays.length}x/semana`,
      day
        ? day.isRest
          ? "Hoje: descanso"
          : `Treino de hoje: ${day.label} (${day.exercises.length} exercícios)`
        : "",
      s.plan ? `Dieta: ~${s.plan.nutrition.kcal} kcal, proteína ${s.plan.nutrition.proteinG}g` : "",
      `Histórico: ${completed} treinos concluídos · ${s.mealLogs.length} refeições logadas` +
        (lastWeight ? ` · último peso ${lastWeight.value}kg` : ""),
      `Restrições: ${s.profile.injuries} · orçamento comida ${s.profile.budgetFood}`,
      `Plano do app: ${s.subscription}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, tone: s.profile.tone, context }),
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return typeof data.text === "string" && data.text.trim() ? data.text.trim() : null;
  } catch {
    return null;
  }
}
