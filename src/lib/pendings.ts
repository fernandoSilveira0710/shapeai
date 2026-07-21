import type { AppState, WorkoutSession } from "@/lib/types";
import { dayKey, nowParts } from "@/lib/utils";

export type Pending =
  | { type: "post_workout_feedback"; session: WorkoutSession }
  | { type: "weight_due"; daysSince: number | null }
  | { type: "measures_due"; daysSince: number | null }
  | { type: "meal_check"; slot: "cafe" | "almoco" | "lanche" | "janta" }
  | { type: "meal_gap_yesterday"; slots: string[]; date: string };

export const SLOT_LABELS: Record<string, string> = {
  cafe: "café",
  almoco: "almoço",
  lanche: "lanche",
  janta: "janta",
};

type PendingsInput = Pick<AppState, "sessions" | "metrics" | "mealLogs" | "profile">;

const DAY_MS = 86_400_000;

function daysSince(iso: string | undefined) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
}

/**
 * Pendências do "personal vivo", já em ordem de prioridade:
 * feedback do último treino > peso 7d+ > medidas 14d+ > refeição sem log no horário.
 */
export function computePendings(s: PendingsInput): Pending[] {
  const out: Pending[] = [];
  const { hour } = nowParts();

  // 1) treino recém-fechado sem feedback (até 20h atrás — depois esfria)
  const lastDone = [...s.sessions]
    .filter(
      (x) =>
        (x.status === "completed" || x.status === "partial") &&
        x.endedAt &&
        x.sets.some((st) => st.status === "completed")
    )
    .sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""))[0];
  if (
    lastDone &&
    !lastDone.feedback &&
    Date.now() - new Date(lastDone.endedAt!).getTime() < 20 * 3600_000
  ) {
    out.push({ type: "post_workout_feedback", session: lastDone });
  }

  // 2) peso vencido (7d+ desde o último, ou nunca)
  const lastWeight = [...s.metrics]
    .filter((m) => m.kind === "weight")
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  const wDays = daysSince(lastWeight?.measuredAt);
  if (wDays === null || wDays >= 7) {
    out.push({ type: "weight_due", daysSince: wDays });
  }

  // 3) medidas vencidas (14d+ ou nunca) — só cobra depois de 1 semana de app
  const lastMeasure = [...s.metrics]
    .filter((m) => m.kind !== "weight")
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  const mDays = daysSince(lastMeasure?.measuredAt);
  const oldestSession = [...s.sessions].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt)
  )[0];
  const appAgeDays = daysSince(oldestSession?.startedAt) ?? 0;
  if (appAgeDays >= 7 && (mDays === null || mDays >= 14)) {
    out.push({ type: "measures_due", daysSince: mDays });
  }

  const hasDieta = !s.profile || s.profile.modules.includes("dieta");

  if (hasDieta) {
    // 4) refeição de ontem sem log em nenhum slot do plano — reconcilia antes
    // de cobrar hoje (prioridade maior que o meal_check do dia atual)
    const yKey = dayKey(-1);
    if (!s.profile || yKey >= s.profile.createdAt.slice(0, 10)) {
      const mealsYesterday = s.mealLogs.filter((m) => m.loggedAt.startsWith(yKey));
      const expectedSlots: (keyof typeof SLOT_LABELS)[] = ["cafe", "almoco", "lanche", "janta"];
      const missing = expectedSlots.filter(
        (slot) => !mealsYesterday.some((m) => m.slot === slot)
      );
      if (missing.length > 0) {
        out.push({ type: "meal_gap_yesterday", slots: missing, date: yKey });
      }
    }

    // 5) refeição principal sem log no horário (hoje)
    const today = dayKey(0);
    const mealsToday = s.mealLogs.filter((m) => m.loggedAt.startsWith(today));
    const has = (slot: string) => mealsToday.some((m) => m.slot === slot);
    if (hour >= 6 && hour <= 10 && !has("cafe")) out.push({ type: "meal_check", slot: "cafe" });
    else if (hour >= 12 && hour <= 15 && !has("almoco"))
      out.push({ type: "meal_check", slot: "almoco" });
    else if (hour >= 15 && hour <= 18 && !has("lanche"))
      out.push({ type: "meal_check", slot: "lanche" });
    else if (hour >= 19 && hour <= 22 && !has("janta"))
      out.push({ type: "meal_check", slot: "janta" });
  }

  return out;
}

/** Resumo das pendências pro context pack do LLM */
export function pendingsForContext(s: PendingsInput): string {
  const p = computePendings(s);
  if (!p.length) return "Pendências: nenhuma";
  return (
    "Pendências (cobrar com naturalidade, sem listar tudo de uma vez):\n" +
    p
      .map((x) => {
        switch (x.type) {
          case "post_workout_feedback":
            return `- Treino "${x.session.label}" fechado sem feedback — puxa assunto: como foi, como o corpo respondeu`;
          case "weight_due":
            return x.daysSince === null
              ? "- Nunca registrou peso — pede o primeiro número"
              : `- Peso vencido há ${x.daysSince} dias — cobra a balança`;
          case "measures_due":
            return x.daysSince === null
              ? "- Nunca tirou medidas — sugere fita métrica (cintura, peito, braço, coxa)"
              : `- Medidas vencidas há ${x.daysSince} dias`;
          case "meal_check":
            return `- ${SLOT_LABELS[x.slot]} sem registro hoje — pergunta o prato`;
          case "meal_gap_yesterday":
            return `- Ontem (${x.date}) faltou log de: ${x.slots.map((s) => SLOT_LABELS[s] ?? s).join(", ")} — pergunta o que rolou. Se a resposta for vaga ("esqueci", sem detalhe), NÃO invente log, é furo. Se ele descrever o que comeu, chame log_past_meal com date="${x.date}" (NÃO log_meal — log_meal é só pra HOJE), um por slot descrito.`;
        }
      })
      .join("\n")
  );
}
