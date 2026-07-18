import type { AppState } from "@/lib/types";
import { planDayForDate } from "@/lib/plan-generator";
import { todayKey } from "@/lib/utils";

/**
 * Motor de lembretes local (MVP): notificação nativa no horário de treino
 * enquanto o app está aberto/em aba. Push real com app fechado = OneSignal
 * (fase 2) — este motor vira fallback.
 */

const FIRED_KEY = "shape-reminder-fired";

export async function requestReminderPermission(): Promise<
  "granted" | "denied" | "unsupported"
> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const res = await Notification.requestPermission();
    return res === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

function minutesOf(hhmm: string): number | null {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function reminderCopy(
  tone: string,
  time: string,
  label: string
): { title: string; body: string } {
  switch (tone) {
    case "sargento":
      return { title: "Shape", body: `${time}. TREINO ${label.toUpperCase()}. APRESENTE-SE.` };
    case "nutella":
      return { title: "Shape 💛", body: `${time} — teu treino de ${label} tá te esperando. Vai com calma e vai!` };
    case "low_profile":
      return { title: "Shape", body: `${time}. Treino: ${label}.` };
    default:
      return { title: "Shape 🔥", body: `${time}, meu rei. Academia te espera — ${label} hoje.` };
  }
}

type ReminderState = Pick<AppState, "profile" | "plan" | "sessions">;

/**
 * Checa se é hora de cutucar: dia de treino, janela [T-10min, T+3h],
 * treino ainda não feito, 1 disparo por dia.
 */
export function maybeFireTrainReminder(s: ReminderState): boolean {
  const p = s.profile;
  if (!p?.wantsReminders || !p.trainTime || !p.intakeCompleted) return false;
  if (typeof Notification === "undefined" || Notification.permission !== "granted")
    return false;

  const today = todayKey();
  try {
    if (localStorage.getItem(FIRED_KEY) === today) return false;
  } catch {
    /* sem localStorage, segue */
  }

  const day = s.plan ? planDayForDate(s.plan) : null;
  if (!day || day.isRest) return false;

  const doneToday = s.sessions.some(
    (x) =>
      x.date === today &&
      (x.status === "completed" || x.status === "partial" || x.status === "in_progress")
  );
  if (doneToday) return false;

  const target = minutesOf(p.trainTime);
  if (target === null) return false;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < target - 10 || nowMin > target + 180) return false;

  const { title, body } = reminderCopy(p.tone, p.trainTime, day.label);
  try {
    new Notification(title, {
      body,
      icon: "/icons/icon-192.png",
      tag: "shape-train-reminder",
    });
    localStorage.setItem(FIRED_KEY, today);
    return true;
  } catch {
    return false;
  }
}

/** Liga o motor: checa a cada minuto + quando a aba volta a ficar visível. */
export function startReminderEngine(getState: () => ReminderState): () => void {
  const tick = () => {
    try {
      maybeFireTrainReminder(getState());
    } catch {
      /* nunca derruba o app por causa de lembrete */
    }
  };
  tick();
  const interval = setInterval(tick, 60_000);
  const onVisible = () => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
