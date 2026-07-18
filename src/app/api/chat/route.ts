import { createOpenAI } from "@ai-sdk/openai";
import { streamText, tool, stepCountIs } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";

export type ChatAction =
  | { type: "open_workout" }
  | { type: "log_weight"; kg: number }
  | { type: "log_meal"; slot: string; description: string; adherence: string }
  | { type: "redesign_plan"; instruction: string }
  | { type: "log_skip"; reason?: string }
  | { type: "finish_intake" }
  | { type: "set_schedule"; trainTime?: string; wantsReminders?: boolean };

/**
 * Chat streaming + tools.
 * Client envia: { messages, tone, context }
 * Resposta: text stream; no fim anexa linha [[SHAPE_ACTIONS]]{json}
 * Sem API key → 503 { fallback: true }
 */
export async function POST(req: NextRequest) {
  const apiKey =
    process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey) {
    return Response.json(
      { error: "LLM not configured", fallback: true },
      { status: 503 }
    );
  }

  const body = await req.json();
  const {
    messages = [],
    tone = "brother",
    context = "",
  }: {
    messages?: { role: "user" | "assistant"; content: string }[];
    tone?: string;
    context?: string;
  } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  // Free gate server-side (client também checa; defense in depth se mandar header)
  const plan = req.headers.get("x-shape-plan") || "basic";
  const dailyCount = Number(req.headers.get("x-shape-daily-count") || "0");
  if (plan === "free" && dailyCount >= 15) {
    return Response.json(
      {
        error: "free_limit",
        fallback: true,
        text: "No Free você tem 15 msgs/dia com a IA. Amanhã reseta — ou sobe pro Básico e a gente conversa solto.",
      },
      { status: 429 }
    );
  }

  const baseURL =
    process.env.OPENAI_BASE_URL ||
    (process.env.LLM_PROVIDER === "deepseek"
      ? "https://api.deepseek.com"
      : undefined);
  const model =
    process.env.OPENAI_MODEL ||
    (process.env.LLM_PROVIDER === "deepseek" ? "deepseek-chat" : "gpt-4o-mini");

  const openai = createOpenAI({ apiKey, baseURL });
  const actions: ChatAction[] = [];

  const system = buildSystemPrompt(tone, context);

  try {
    const result = streamText({
      model: openai.chat(model),
      system,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools: {
        open_workout_session: tool({
          description:
            "Abre o modo treino do dia quando o usuário topar treinar agora (bora, vamos, iniciar).",
          inputSchema: z.object({
            confirm: z.boolean().optional().describe("true se user confirmou"),
          }),
          execute: async () => {
            actions.push({ type: "open_workout" });
            return { ok: true, message: "Sessão de treino será aberta no app." };
          },
        }),
        log_weight: tool({
          description: "Registra peso corporal em kg (não carga de exercício).",
          inputSchema: z.object({
            kg: z.number().min(30).max(250),
          }),
          execute: async ({ kg }) => {
            actions.push({ type: "log_weight", kg });
            return { ok: true, kg };
          },
        }),
        log_meal: tool({
          description: "Registra refeição descrita pelo usuário.",
          inputSchema: z.object({
            slot: z
              .enum(["cafe", "almoco", "lanche", "janta", "outro"])
              .describe("refeição"),
            description: z.string(),
            adherence: z
              .enum(["on_plan", "partial", "off"])
              .describe("aderência ao plano"),
          }),
          execute: async ({ slot, description, adherence }) => {
            actions.push({ type: "log_meal", slot, description, adherence });
            return { ok: true, slot };
          },
        }),
        redesign_plan: tool({
          description:
            "Pede redesign do plano (treino/dieta) com instrução do usuário (orçamento, lesão, dia, etc.).",
          inputSchema: z.object({
            instruction: z.string(),
          }),
          execute: async ({ instruction }) => {
            actions.push({ type: "redesign_plan", instruction });
            return { ok: true, instruction };
          },
        }),
        log_skip: tool({
          description: "Registra que o usuário vai pular/furou o treino.",
          inputSchema: z.object({
            reason: z.string().optional(),
          }),
          execute: async ({ reason }) => {
            actions.push({ type: "log_skip", reason });
            return { ok: true };
          },
        }),
        set_schedule: tool({
          description:
            "Salva o horário combinado de treino e/ou se o usuário quer ser lembrado (notificação). Chame assim que ele informar.",
          inputSchema: z.object({
            trainTime: z
              .string()
              .optional()
              .describe("horário de treino HH:MM, ex 06:00"),
            wantsReminders: z.boolean().optional(),
          }),
          execute: async ({ trainTime, wantsReminders }) => {
            actions.push({ type: "set_schedule", trainTime, wantsReminders });
            return { ok: true };
          },
        }),
        finish_intake: tool({
          description:
            "Fecha o dossiê do primeiro contato. Chame quando já conheceu o usuário o suficiente (6+ respostas cobrindo motivação, histórico, horários e rotina) OU quando o contexto mandar encerrar.",
          inputSchema: z.object({
            summary: z
              .string()
              .optional()
              .describe("resumo de 1 frase do que aprendeu"),
          }),
          execute: async () => {
            actions.push({ type: "finish_intake" });
            return { ok: true, message: "Dossiê marcado como completo no app." };
          },
        }),
      },
      // multi-step: tool call → execute → resposta final
      stopWhen: stepCountIs(4),
      maxRetries: 1,
    });

    const textStream = result.toTextStreamResponse();
    const reader = textStream.body?.getReader();
    if (!reader) {
      return Response.json({ error: "no stream", fallback: true }, { status: 502 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          // garante que tools terminaram
          await result.consumeStream();
          if (actions.length) {
            controller.enqueue(
              encoder.encode(`\n[[SHAPE_ACTIONS]]${JSON.stringify(actions)}`)
            );
          }
          controller.close();
        } catch (e) {
          console.error("chat stream pipe error", e);
          controller.error(e);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Shape-Stream": "1",
      },
    });
  } catch (e) {
    console.error("chat route error", e);
    return Response.json(
      { error: "LLM failed", fallback: true },
      { status: 502 }
    );
  }
}
