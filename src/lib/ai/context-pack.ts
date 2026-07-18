import type { AppState, ChatMessage } from "@/lib/types";
import { planDayForDate } from "@/lib/plan-generator";
import { pendingsForContext } from "@/lib/pendings";
import { nowParts, todayKey } from "@/lib/utils";

export type ContextPackInput = Pick<
  AppState,
  "profile" | "plan" | "sessions" | "mealLogs" | "metrics" | "subscription"
>;

/** Context pack legível pro system prompt (AI-ENGINE). */
export function buildContextPack(s: ContextPackInput): string {
  if (!s.profile) return "(sem perfil)";
  const { time, weekday, hour } = nowParts();
  const today = todayKey();
  const day = s.plan ? planDayForDate(s.plan) : null;
  const workoutDoneToday = s.sessions.some(
    (x) => x.date === today && (x.status === "completed" || x.status === "partial")
  );
  const lastWeight = s.metrics
    .filter((m) => m.kind === "weight")
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  const completed = s.sessions.filter((x) => x.status === "completed").length;
  const mealsToday = s.mealLogs.filter((m) => m.loggedAt.startsWith(today));
  const streakish = completed; // simplificado; streak real no client

  return [
    `Agora: ${weekday}, ${time} (hora ${hour}) TZ America/Sao_Paulo`,
    `Nome: ${s.profile.displayName}`,
    `Objetivo: ${s.profile.goal} · ${s.profile.weightKg}kg · ${s.profile.heightCm}cm · ${s.profile.age} anos`,
    `Experiência: ${s.profile.experience} · dias treino: ${s.profile.trainDays.join(",") || "—"} · ${s.profile.trainDurationMin}min`,
    `Equipamento: ${s.profile.equipment.join(", ")}`,
    `Lesões: ${s.profile.injuries}`,
    `Rotina: trabalho=${s.profile.workType} · orçamento comida=${s.profile.budgetFood} · cozinha=${s.profile.cooksAtHome}`,
    `Restrições dieta: ${s.profile.dietRestrictions.join(", ") || "nenhuma"}`,
    day
      ? day.isRest
        ? "Hoje no plano: DESCANSO"
        : `Treino de hoje: ${day.label} (${day.exercises.length} exercícios, ~${day.durationMin}min) · já feito? ${workoutDoneToday ? "SIM" : "NÃO"}`
      : "Sem plano de treino",
    s.plan
      ? `Dieta: ~${s.plan.nutrition.kcal} kcal · P${s.plan.nutrition.proteinG}g C${s.plan.nutrition.carbsG}g G${s.plan.nutrition.fatG}g · plano v${s.plan.version}`
      : "",
    s.plan
      ? `Refeições modelo: ${s.plan.nutrition.meals.map((m) => `${m.title}: ${m.items[0]}`).join(" | ")}`
      : "",
    `Métricas: ${completed} treinos concluídos · ${s.mealLogs.length} refeições log · streak-proxy ${streakish}`,
    lastWeight
      ? `Último peso: ${lastWeight.value}kg em ${lastWeight.measuredAt.slice(0, 10)}`
      : "Sem peso registrado ainda",
    `Refeições hoje: ${mealsToday.length ? mealsToday.map((m) => `${m.slot}:${m.description}`).join("; ") : "nenhuma"}`,
    `Assinatura app: ${s.subscription} (free=limitado, basic=chat+treino+nutri texto, pro=vision)`,
    s.profile.intakeCompleted === false
      ? `FASE: primeiro contato / dossiê ainda aberto — entrevista em andamento (${s.profile.intakeNotes?.length ?? 0} respostas colhidas).${
          (s.profile.intakeNotes?.length ?? 0) >= 9
            ? " JÁ TEM MATERIAL SUFICIENTE: encerre agora com finish_intake."
            : ""
        }`
      : "FASE: dossiê de intake completo",
    s.profile.intakeNotes?.length
      ? `Dossiê intake (métricas pro personal):\n${s.profile.intakeNotes
          .map((n) => `- [${n.metricLabel || n.key}] ${n.answer}`)
          .join("\n")}`
      : "",
    pendingsForContext(s),
    (() => {
      const lastFb = [...s.sessions]
        .filter((x) => x.feedback)
        .sort((a, b) => (b.feedbackAt ?? "").localeCompare(a.feedbackAt ?? ""))[0];
      return lastFb
        ? `Último feedback pós-treino (${lastFb.label}): "${lastFb.feedback}" — usa isso pra ajustar conversa e treino`
        : "";
    })(),
  ]
    .filter(Boolean)
    .join("\n");
}

export function historyForLlm(messages: ChatMessage[], max = 16) {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => m.content?.trim())
    .slice(-max)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 2000),
    }));
}

export function toneBlock(tone: string) {
  switch (tone) {
    case "sargento":
      return "Sargento: frases curtas, ordem, CAPS pontual, zero firula, cobrança máxima sem humilhar corpo.";
    case "nutella":
      return "Nutella: calor humano, encoraja, emoji ok, cobrança suave.";
    case "low_profile":
      return "Low profile: seco, informativo, sem bordão, quase zero emoji.";
    default:
      return "Brother: gíria leve BR, 'meu rei', zoa sem humilhar, emoji moderado, cobrança média-alta.";
  }
}
