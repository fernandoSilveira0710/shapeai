import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function dayKey(offsetDays = 0, tz = "America/Sao_Paulo") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000));
}

export function todayKey(tz = "America/Sao_Paulo") {
  return dayKey(0, tz);
}

/** weekday (0-6) de uma dayKey YYYY-MM-DD, independente do TZ do browser */
export function weekdayOfKey(key: string) {
  return new Date(`${key}T12:00:00`).getDay();
}

export function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* noop */
    }
  }
}

export function nowParts(tz = "America/Sao_Paulo") {
  const d = new Date();
  const time = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  const weekday = new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
  }).format(d);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    }).format(d)
  );
  return { time, weekday, hour, date: todayKey(tz) };
}
