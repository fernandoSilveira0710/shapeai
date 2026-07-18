import type { AppState, ChatMessage, RichCard } from "@/lib/types";
import {
  buildContextPack,
  historyForLlm,
} from "@/lib/ai/context-pack";
import type { ChatAction } from "@/app/api/chat/route";

export type StreamResult = {
  text: string;
  actions: ChatAction[];
  fallback: boolean;
};

/**
 * Stream LLM via /api/chat. onToken recebe deltas.
 * Sem key/erro → fallback:true e text vazio (caller usa rule-based).
 */
export async function streamLlmReply(
  s: Pick<
    AppState,
    | "profile"
    | "plan"
    | "sessions"
    | "mealLogs"
    | "metrics"
    | "subscription"
    | "messages"
    | "dailyLlmCount"
    | "dailyLlmDate"
  >,
  onToken: (chunk: string) => void,
  signal?: AbortSignal
): Promise<StreamResult> {
  if (!s.profile) return { text: "", actions: [], fallback: true };

  const context = buildContextPack(s);
  const messages = historyForLlm(s.messages);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-shape-plan": s.subscription,
        "x-shape-daily-count": String(s.dailyLlmCount ?? 0),
      },
      body: JSON.stringify({
        messages,
        tone: s.profile.tone,
        context,
      }),
      signal: signal ?? AbortSignal.timeout(45_000),
    });

    if (res.status === 503 || res.status === 429) {
      const data = (await res.json().catch(() => ({}))) as {
        text?: string;
        fallback?: boolean;
      };
      if (data.text) {
        onToken(data.text);
        return { text: data.text, actions: [], fallback: true };
      }
      return { text: "", actions: [], fallback: true };
    }

    if (!res.ok || !res.body) {
      return { text: "", actions: [], fallback: true };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      full += chunk;

      // não manda pro UI o marcador de actions (pode chegar no meio do fim)
      const cut = full.indexOf("\n[[SHAPE_ACTIONS]]");
      const visible =
        cut === -1
          ? full
          : full.slice(0, cut);
      // delta: só o que ainda não foi "emitido" como visible estável
      // simplifica: re-emite por callback o trecho novo de visible
      onToken(chunk.includes("[[SHAPE_ACTIONS]]") ? chunk.split("\n[[SHAPE_ACTIONS]]")[0] : chunk);
      void visible;
    }

    let actions: ChatAction[] = [];
    const marker = "\n[[SHAPE_ACTIONS]]";
    const idx = full.lastIndexOf(marker);
    let text = full;
    if (idx !== -1) {
      text = full.slice(0, idx).trim();
      try {
        actions = JSON.parse(full.slice(idx + marker.length)) as ChatAction[];
      } catch {
        actions = [];
      }
    } else {
      text = full.trim();
    }

    // limpa tokens brutos do onToken acumulado — caller usa text final
    return { text, actions, fallback: false };
  } catch {
    return { text: "", actions: [], fallback: true };
  }
}

/** Compat: resposta one-shot (sem stream) se alguém ainda chamar */
export async function tryLlmReply(
  _message: string,
  s: Pick<
    AppState,
    "profile" | "plan" | "sessions" | "mealLogs" | "metrics" | "subscription" | "messages" | "dailyLlmCount" | "dailyLlmDate"
  >
): Promise<string | null> {
  let acc = "";
  const r = await streamLlmReply(s, (c) => {
    acc += c;
  });
  if (r.fallback && !r.text) return null;
  return r.text || acc || null;
}

export type ApplyActionsResult = {
  navigateToWorkout?: string;
  rich?: RichCard;
};
