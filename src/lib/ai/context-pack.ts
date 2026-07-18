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
  const intakeOpen = s.profile.intakeCompleted === false;
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
    (() => {
      const h = s.profile.heightCm / 100;
      const imc = Math.round((s.profile.weightKg / (h * h)) * 10) / 10;
      const bmr =
        10 * s.profile.weightKg + 6.25 * s.profile.heightCm - 5 * s.profile.age + 5;
      return `Leitura técnica: IMC ${imc} · TDEE estimado ~${Math.round(bmr * 1.45)} kcal`;
    })(),
    s.profile.trainTime
      ? `Horário combinado de treino: ${s.profile.trainTime} · lembretes: ${s.profile.wantsReminders ? "SIM" : "não definido"}`
      : "",
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
      ? `Dieta: ~${s.plan.nutrition.kcal} kcal · P${s.plan.nutrition.proteinG}g C${s.plan.nutrition.carbsG}g G${s.plan.nutrition.fatG}g · plano v${s.plan.version} · ${s.plan.approvedAt ? "APROVADO pelo usuário" : "ainda NÃO aprovado"}`
      : "",
    s.plan
      ? `Opções de refeição atuais:\n${s.plan.nutrition.meals
          .map((m) => `${m.title}: ${m.items.join(" | ")}`)
          .join("\n")}`
      : "",
    s.plan
      ? `Refeições modelo: ${s.plan.nutrition.meals.map((m) => `${m.title}: ${m.items[0]}`).join(" | ")}`
      : "",
    `Métricas: ${completed} treinos concluídos · ${s.mealLogs.length} refeições log · streak-proxy ${streakish}`,
    lastWeight
      ? `Último peso: ${lastWeight.value}kg em ${lastWeight.measuredAt.slice(0, 10)}`
      : "Sem peso registrado ainda",
    // agenda do dia só existe DEPOIS do dossiê — senão a IA cobra café no meio da entrevista
    intakeOpen
      ? ""
      : `Refeições hoje: ${mealsToday.length ? mealsToday.map((m) => `${m.slot}:${m.description}`).join("; ") : "nenhuma"}`,
    `Assinatura app: ${s.subscription} (free=limitado, basic=chat+treino+nutri texto, pro=vision)`,
    s.profile.intakeCompleted === false
      ? `FASE: primeiro contato / dossiê ainda aberto — entrevista em andamento (${s.profile.intakeNotes?.length ?? 0} respostas colhidas).${
          (s.profile.intakeNotes?.length ?? 0) >= 7
            ? " JÁ TEM MATERIAL SUFICIENTE: encerre AGORA com finish_intake — não faça mais perguntas."
            : ""
        }`
      : "FASE: dossiê de intake completo",
    s.profile.intakeNotes?.length
      ? `Dossiê intake (métricas pro personal):\n${s.profile.intakeNotes
          .map((n) => `- [${n.metricLabel || n.key}] ${n.answer}`)
          .join("\n")}`
      : "",
    intakeOpen ? "" : pendingsForContext(s),
    (() => {
      const lastFb = [...s.sessions]
        .filter((x) => x.feedback)
        .sort((a, b) => (b.feedbackAt ?? "").localeCompare(a.feedbackAt ?? ""))[0];
      return lastFb
        ? `Último feedback pós-treino (${lastFb.label}): "${lastFb.feedback}" — usa isso pra ajustar conversa e treino`
        : "";
    })(),
    (() => {
      // última sessão fechada: duração real vs prevista + notas de treino + comparação de carga
      const lastDone = [...s.sessions]
        .filter(
          (x) => (x.status === "completed" || x.status === "partial") && x.endedAt
        )
        .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0];
      if (!lastDone) return "";
      const realMin = Math.round(
        (new Date(lastDone.endedAt!).getTime() -
          new Date(lastDone.startedAt).getTime()) /
          60000
      );
      const planned = s.plan?.workoutDays.find(
        (d) => d.weekday === lastDone.planDayWeekday
      )?.durationMin;
      const lines = [
        `Última sessão (${lastDone.label}, ${lastDone.date}): ${realMin}min${planned ? ` (previsto ~${planned}min)` : ""}${planned && realMin < planned * 0.6 ? " — MUITO RÁPIDA, vale questionar concentração/descanso" : ""}`,
      ];
      if (lastDone.notes?.length) {
        lines.push(
          `Notas escritas DURANTE o treino: ${lastDone.notes.map((n) => `"${n.text}"`).join(" · ")}`
        );
      }
      return lines.join("\n");
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
