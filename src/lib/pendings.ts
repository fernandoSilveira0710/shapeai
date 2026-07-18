import type { AppState, WorkoutSession } from "@/lib/types";
import { nowParts } from "@/lib/utils";

export type Pending =
  | { type: "post_workout_feedback"; session: WorkoutSession }
  | { type: "weight_due"; daysSince: number | null }
  | { type: "measures_due"; daysSince: number | null }
  | { type: "meal_check"; slot: "almoco" | "janta" };

type PendingsInput = Pick<AppState, "sessions" | "metrics" | "mealLogs">;

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

  // 4) refeição principal sem log no horário
  const today = new Date().toISOString().slice(0, 10);
  const mealsToday = s.mealLogs.filter((m) => m.loggedAt.startsWith(today));
  const hasLunch = mealsToday.some((m) => m.slot === "almoco");
  const hasDinner = mealsToday.some((m) => m.slot === "janta");
  if (hour >= 12 && hour <= 15 && !hasLunch) out.push({ type: "meal_check", slot: "almoco" });
  else if (hour >= 19 && hour <= 22 && !hasDinner) out.push({ type: "meal_check", slot: "janta" });

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
            return `- ${x.slot === "almoco" ? "Almoço" : "Janta"} sem registro hoje — pergunta o prato`;
        }
      })
      .join("\n")
  );
}
