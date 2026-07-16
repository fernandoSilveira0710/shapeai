"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Send, Sparkles } from "lucide-react";
import { TabBar } from "@/components/tab-bar";
import { Button, Chip, Sheet, TypingDots } from "@/components/ui";
import { TONE_META } from "@/lib/tone";
import { planDayForDate } from "@/lib/plan-generator";
import { cn, dayKey, nowParts, vibrate } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import type { ChatMessage } from "@/lib/types";

const GROUP_GAP_MS = 60_000;

function dayOf(m: ChatMessage) {
  return m.createdAt.slice(0, 10);
}

function dayLabel(key: string) {
  if (key === dayKey(0)) return "Hoje";
  if (key === dayKey(-1)) return "Ontem";
  const d = new Date(`${key}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long" }).format(d);
}

function timeOf(m: ChatMessage) {
  return new Date(m.createdAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Revela o texto progressivamente (só pra mensagens novas da IA) */
function Typewriter({
  text,
  animate,
  onTick,
}: {
  text: string;
  animate: boolean;
  onTick: () => void;
}) {
  const [shown, setShown] = useState(animate ? 0 : text.length);
  const doneRef = useRef(!animate);

  useEffect(() => {
    if (!animate || doneRef.current) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(text.length);
      doneRef.current = true;
      return;
    }
    let i = 0;
    // revela em ~0.8s independente do tamanho
    const step = Math.max(1, Math.ceil(text.length / 50));
    const t = setInterval(() => {
      i += step;
      setShown(Math.min(i, text.length));
      onTick();
      if (i >= text.length) {
        doneRef.current = true;
        clearInterval(t);
      }
    }, 16);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, text]);

  const typing = animate && shown < text.length;
  return (
    <span className={typing ? "typewriter-caret" : undefined}>
      {text.slice(0, shown)}
    </span>
  );
}

/** Comprime imagem pra data URL leve (max 512px, jpeg) */
async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export default function ChatPage() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const plan = useAppStore((s) => s.plan);
  const messages = useAppStore((s) => s.messages);
  const typing = useAppStore((s) => s.typing);
  const subscription = useAppStore((s) => s.subscription);
  const hydrateOpening = useAppStore((s) => s.hydrateOpening);
  const sendUserMessage = useAppStore((s) => s.sendUserMessage);
  const sendImageMessage = useAppStore((s) => s.sendImageMessage);
  const startWorkout = useAppStore((s) => s.startWorkout);
  const addMessage = useAppStore((s) => s.addMessage);
  const logWeight = useAppStore((s) => s.logWeight);

  const [text, setText] = useState("");
  const [weightSheet, setWeightSheet] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedAt = useRef(Date.now());

  useEffect(() => {
    if (!profile?.onboardingCompleted) {
      router.replace("/");
      return;
    }
    hydrateOpening();
  }, [profile, router, hydrateOpening]);

  function scrollToBottom(force = false) {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
    if (force || nearBottom) el.scrollTop = el.scrollHeight;
  }

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, typing]);

  // autogrow textarea (max 4 linhas)
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 4 * 22 + 20)}px`;
  }, [text]);

  function handleSend(raw?: string) {
    const value = (raw ?? text).trim();
    if (!value) return;
    setText("");
    vibrate(8);
    const result = sendUserMessage(value);
    if (result.navigateToWorkout) {
      router.push(`/workout/${result.navigateToWorkout}`);
    }
  }

  function handleCardCta(type: string) {
    if (type === "workout") {
      const id = startWorkout();
      if (id) {
        addMessage({ role: "user", content: "bora" });
        addMessage({
          role: "assistant",
          content: "Treino aberto. Bora série por série.",
        });
        vibrate(15);
        router.push(`/workout/${id}`);
      }
    }
    if (type === "meal_check") handleSend("já comi");
    if (type === "paywall") router.push("/me");
  }

  async function handlePickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      sendImageMessage(dataUrl, text.trim() || undefined);
      setText("");
    } catch {
      addMessage({
        role: "assistant",
        content: "Não consegui ler essa imagem. Tenta outra?",
      });
    }
  }

  function handleCameraClick() {
    if (subscription !== "pro") {
      handleSend("quero mandar foto do prato");
      return;
    }
    fileInputRef.current?.click();
  }

  function saveWeight() {
    const n = Number(weightInput.replace(",", "."));
    if (n >= 30 && n <= 250) {
      logWeight(n);
      addMessage({ role: "user", content: `${n} kg` });
      addMessage({
        role: "assistant",
        content: `${n} kg anotado. A gente olha a tendência, não um dia só.`,
      });
      vibrate(15);
      setWeightSheet(false);
      setWeightInput("");
    }
  }

  const grouped = useMemo(() => {
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const gapPrev = prev
        ? new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()
        : Infinity;
      const gapNext = next
        ? new Date(next.createdAt).getTime() - new Date(m.createdAt).getTime()
        : Infinity;
      return {
        m,
        newDay: !prev || dayOf(prev) !== dayOf(m),
        firstOfGroup: !prev || prev.role !== m.role || gapPrev > GROUP_GAP_MS,
        lastOfGroup: !next || next.role !== m.role || gapNext > GROUP_GAP_MS,
      };
    });
  }, [messages]);

  if (!profile) {
    return (
      <div className="app-shell items-center justify-center text-muted text-sm">
        Carregando…
      </div>
    );
  }

  const { time } = nowParts();
  const day = plan ? planDayForDate(plan) : null;
  const chips = [
    day && !day.isRest ? "Bora treinar" : null,
    "Já almocei",
    "Registrar peso",
    "Como estou?",
  ].filter(Boolean) as string[];

  return (
    <div className="app-shell">
      <header className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-3">
        <div className="size-10 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
          <Sparkles className="size-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold leading-tight">Shape</div>
          <div className="text-xs text-muted truncate">
            {typing ? (
              <span className="text-brand">digitando…</span>
            ) : (
              <>
                {TONE_META[profile.tone].label} · {time}
                {day && !day.isRest ? ` · ${day.label}` : " · rest"}
              </>
            )}
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-3 py-4">
        {grouped.map(({ m, newDay, firstOfGroup, lastOfGroup }) => {
          const isUser = m.role === "user";
          const isSystem = m.role === "system";
          const isNew =
            m.role === "assistant" &&
            new Date(m.createdAt).getTime() > mountedAt.current - 300;

          return (
            <div key={m.id}>
              {newDay && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-border/60" />
                  <span className="text-[11px] text-muted font-medium">
                    {dayLabel(dayOf(m))}
                  </span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>
              )}

              {isSystem ? (
                <div className="mx-auto text-center text-xs text-muted my-2 animate-rise">
                  {m.content}
                </div>
              ) : (
                <div
                  className={cn(
                    "flex w-full animate-rise",
                    isUser ? "justify-end" : "justify-start",
                    firstOfGroup ? "mt-3" : "mt-1"
                  )}
                >
                  {!isUser && (
                    <div className="mr-2 flex w-7 shrink-0 items-end">
                      {lastOfGroup && (
                        <div className="size-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
                          <Sparkles className="size-3.5 text-brand" />
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex max-w-[85%] flex-col",
                      isUser ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words",
                        isUser
                          ? "bg-brand text-brand-fg"
                          : "bg-surface border border-border",
                        isUser
                          ? lastOfGroup
                            ? "rounded-[16px_16px_4px_16px]"
                            : "rounded-[16px_4px_4px_16px]"
                          : lastOfGroup
                            ? "rounded-[16px_16px_16px_4px]"
                            : "rounded-[4px_16px_16px_4px]"
                      )}
                    >
                      {m.imageDataUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.imageDataUrl}
                          alt="Foto enviada"
                          className="mb-2 max-h-52 w-full rounded-xl object-cover"
                        />
                      )}
                      {m.role === "assistant" ? (
                        <Typewriter
                          text={m.content}
                          animate={isNew}
                          onTick={() => scrollToBottom()}
                        />
                      ) : (
                        m.content
                      )}
                    </div>

                    {m.rich && (
                      <div
                        className={cn(
                          "mt-1.5 w-full min-w-[220px] rounded-2xl border p-3 animate-rise",
                          m.rich.type === "paywall"
                            ? "border-warning/40 bg-warning/10"
                            : "border-border bg-elevated"
                        )}
                      >
                        <div className="text-sm font-semibold">{m.rich.title}</div>
                        {m.rich.body && (
                          <p className="text-xs text-muted mt-1">{m.rich.body}</p>
                        )}
                        {m.rich.cta && (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => handleCardCta(m.rich!.type)}
                          >
                            {m.rich.cta}
                          </Button>
                        )}
                      </div>
                    )}

                    {lastOfGroup && (
                      <span className="mt-1 px-1 text-[10px] text-muted/70">
                        {timeOf(m)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {typing && (
          <div className="flex w-full justify-start mt-3 animate-rise">
            <div className="mr-2 flex w-7 shrink-0 items-end">
              <div className="size-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
                <Sparkles className="size-3.5 text-brand" />
              </div>
            </div>
            <div className="rounded-[16px_16px_16px_4px] bg-surface border border-border px-4 py-3">
              <TypingDots />
            </div>
          </div>
        )}
      </div>

      <div className="px-3 pb-2 space-y-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {chips.map((c, i) => (
            <Chip
              key={c}
              className="shrink-0 animate-chip-in"
              style={{ animationDelay: `${i * 45}ms` }}
              onClick={() => {
                vibrate(8);
                if (c === "Registrar peso") {
                  setWeightInput(String(profile.weightKg));
                  setWeightSheet(true);
                  return;
                }
                handleSend(c === "Bora treinar" ? "bora" : c);
              }}
            >
              {c}
            </Chip>
          ))}
        </div>
        <form
          className="flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <button
            type="button"
            onClick={handleCameraClick}
            aria-label={
              subscription === "pro" ? "Enviar foto do prato" : "Foto do prato (Pro)"
            }
            className={cn(
              "size-11 shrink-0 rounded-xl border flex items-center justify-center transition active:scale-95",
              subscription === "pro"
                ? "bg-surface border-border text-muted hover:text-ink"
                : "bg-surface border-border text-muted/50"
            )}
          >
            <Camera className="size-[18px]" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePickImage}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Fala com teu personal…"
            className="flex-1 min-h-11 max-h-28 resize-none rounded-xl bg-surface border border-border px-3 py-2.5 text-[15px] outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/15 transition-colors"
          />
          <Button
            type="submit"
            className="size-11 p-0 shrink-0 active:scale-90 transition-transform"
            aria-label="Enviar"
            disabled={!text.trim()}
          >
            <Send className="size-4" />
          </Button>
        </form>
      </div>

      <Sheet
        open={weightSheet}
        onClose={() => setWeightSheet(false)}
        title="Peso de hoje"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveWeight();
          }}
        >
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              autoFocus
              className="flex-1 h-14 rounded-xl bg-surface border border-border px-4 text-2xl font-bold text-center tabular-nums outline-none focus:border-brand/60"
            />
            <span className="text-muted font-medium">kg</span>
          </div>
          <p className="text-xs text-muted mt-2">
            Mesmo horário, mesma balança — a tendência é o que importa.
          </p>
          <Button type="submit" size="lg" className="w-full mt-4">
            Salvar
          </Button>
        </form>
      </Sheet>

      <TabBar />
    </div>
  );
}
