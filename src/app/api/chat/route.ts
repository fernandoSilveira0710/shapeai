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
  | { type: "set_schedule"; trainTime?: string; wantsReminders?: boolean }
  | { type: "swap_food"; from: string; to: string }
  | { type: "swap_workout_day"; withWeekday: number }
  | { type: "log_past_workout"; date: string; note?: string }
  | { type: "swap_exercise"; weekday: number; fromExerciseId: string; toExerciseId: string }
  | {
      type: "add_exercise";
      weekday: number;
      exerciseId: string;
      sets?: number;
      reps?: string;
    }
  | { type: "remove_exercise"; weekday: number; exerciseId: string }
  | {
      type: "show_card";
      kind: "week_workout" | "week_diet" | "day_workout" | "day_meal" | "progress";
    }
  | { type: "open_weight_log" }
  | { type: "open_measure_log" }
  | { type: "enable_module"; module: "treino" | "dieta" }
  | {
      type: "log_past_meal";
      date: string;
      slot: string;
      description: string;
      adherence: string;
    };

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
          description:
            "Registra refeição de HOJE descrita pelo usuário. SEMPRE chame na hora — nunca pergunte 'posso registrar?' antes, registro é fato, não pedido de permissão. Infira o slot pela hora atual do contexto se ele não disser qual refeição foi. Se a refeição for de um dia ANTERIOR (ex: reconciliando 'ontem faltou log' do contexto), NÃO use esta tool — use log_past_meal com a data certa.",
          inputSchema: z.object({
            slot: z
              .enum(["cafe", "almoco", "lanche", "janta", "outro"])
              .describe("refeição — infira pela hora se não for dito"),
            description: z.string(),
            adherence: z
              .enum(["on_plan", "partial", "off"])
              .describe("aderência ao plano — off pra besteira/fora do plano"),
          }),
          execute: async ({ slot, description, adherence }) => {
            actions.push({ type: "log_meal", slot, description, adherence });
            return { ok: true, slot };
          },
        }),
        show_card: tool({
          description:
            "Mostra o card visual pedido pelo usuário — SEMPRE que ele quiser VER treino, dieta ou progresso, chame isso em vez de descrever em texto (o app renderiza o card bonito, e texto duplicando a lista fica redundante e feio). Funciona igual seja balão clicado ou pedido digitado. kinds: week_workout (treino da semana inteira), week_diet (dieta/opções da semana inteira), day_workout (treino de hoje especificamente), day_meal (a refeição do horário atual), progress (resumo de evolução: treinos, streak, tendência de peso — para 'como estou', 'como tô indo', 'meu progresso').",
          inputSchema: z.object({
            kind: z.enum(["week_workout", "week_diet", "day_workout", "day_meal", "progress"]),
          }),
          execute: async ({ kind }) => {
            actions.push({ type: "show_card", kind });
            return { ok: true, message: "Card mostrado no app." };
          },
        }),
        open_weight_log: tool({
          description:
            "Abre o registro de peso quando o usuário QUER registrar mas ainda não mandou o número (ex: 'quero registrar meu peso', 'bora pesar'). Se ele já mandou o número, use log_weight direto, não isto.",
          inputSchema: z.object({}),
          execute: async () => {
            actions.push({ type: "open_weight_log" });
            return { ok: true };
          },
        }),
        open_measure_log: tool({
          description:
            "Abre o registro de medidas (cintura/peito/braço/coxa) quando o usuário quer registrar mas ainda não mandou os números. Se ele já mandou números com as partes do corpo, isso já é salvo automaticamente pelo app — não precisa desta tool.",
          inputSchema: z.object({}),
          execute: async () => {
            actions.push({ type: "open_measure_log" });
            return { ok: true };
          },
        }),
        enable_module: tool({
          description:
            "Ativa o módulo treino ou dieta quando o usuário pediu algo desse módulo estando ele desligado e confirmou que quer ativar. NÃO chame sem confirmação explícita — pergunte antes.",
          inputSchema: z.object({
            module: z.enum(["treino", "dieta"]),
          }),
          execute: async ({ module }) => {
            actions.push({ type: "enable_module", module });
            return { ok: true, module };
          },
        }),
        redesign_plan: tool({
          description:
            "Redesign LIMITADO — só entende 4 padrões: orçamento apertado, trocar agachamento (dor/preferência joelho), mover treino de sexta, trocar a janta. NÃO serve pra adicionar/remover/contar exercícios (use add_exercise/remove_exercise) nem pra trocar um exercício específico (use swap_exercise). Se a instrução não bater em nenhum dos 4 padrões, NADA muda — o app avisa o usuário, não invente que funcionou.",
          inputSchema: z.object({
            instruction: z.string(),
          }),
          execute: async ({ instruction }) => {
            actions.push({ type: "redesign_plan", instruction });
            return { ok: true, instruction };
          },
        }),
        add_exercise: tool({
          description:
            "Adiciona um exercício a um dia de treino (mais volume pra um grupo muscular). Use quando o usuário pedir mais exercícios de um grupo (ex: 'quero mais bíceps'). exerciseId DEVE ser um id exato do catálogo do contexto. Chame uma vez por exercício — pra adicionar 2, chame 2x.",
          inputSchema: z.object({
            weekday: z.number().min(0).max(6),
            exerciseId: z.string().describe("id exato do catálogo"),
            sets: z.number().min(1).max(6).optional(),
            reps: z.string().optional().describe("ex: '8-12'"),
          }),
          execute: async ({ weekday, exerciseId, sets, reps }) => {
            actions.push({ type: "add_exercise", weekday, exerciseId, sets, reps });
            return { ok: true, message: "Exercício adicionado ao dia." };
          },
        }),
        remove_exercise: tool({
          description:
            "Remove um exercício de um dia de treino (menos volume, ou o usuário não quer mais aquele movimento sem substituto).",
          inputSchema: z.object({
            weekday: z.number().min(0).max(6),
            exerciseId: z.string(),
          }),
          execute: async ({ weekday, exerciseId }) => {
            actions.push({ type: "remove_exercise", weekday, exerciseId });
            return { ok: true, message: "Exercício removido do dia." };
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
        swap_workout_day: tool({
          description:
            "Troca o treino de HOJE pelo treino de outro dia da semana (ex.: usuário fez braço no domingo por fora e hoje quer perna). withWeekday = dia (0=dom..6=sáb) cujo treino será feito hoje.",
          inputSchema: z.object({
            withWeekday: z.number().min(0).max(6),
            reason: z.string().optional().describe("justificativa do usuário"),
          }),
          execute: async ({ withWeekday }) => {
            actions.push({ type: "swap_workout_day", withWeekday });
            return { ok: true, message: "Treinos trocados no plano de hoje." };
          },
        }),
        log_past_workout: tool({
          description:
            "Registra treino que o usuário fez e esqueceu de logar (ex.: 'treinei domingo e não marquei'). date em YYYY-MM-DD.",
          inputSchema: z.object({
            date: z.string().describe("YYYY-MM-DD do treino esquecido"),
            note: z.string().optional().describe("o que ele treinou"),
          }),
          execute: async ({ date, note }) => {
            actions.push({ type: "log_past_workout", date, note });
            return { ok: true, message: `Treino de ${date} registrado.` };
          },
        }),
        log_past_meal: tool({
          description:
            "Registra refeição de um dia anterior que o usuário esqueceu de marcar (ex.: contexto avisa que ontem faltou log e ele descreve o que comeu). Só chame se ele DESCREVER o que comeu — se a resposta for vaga tipo 'esqueci', NÃO chame, deixa como furo.",
          inputSchema: z.object({
            date: z.string().describe("YYYY-MM-DD do dia esquecido"),
            slot: z.enum(["cafe", "almoco", "lanche", "janta", "outro"]),
            description: z.string(),
            adherence: z.enum(["on_plan", "partial", "off"]),
          }),
          execute: async ({ date, slot, description, adherence }) => {
            actions.push({ type: "log_past_meal", date, slot, description, adherence });
            return { ok: true, message: `Refeição de ${date} registrada.` };
          },
        }),
        swap_exercise: tool({
          description:
            "Troca um exercício do treino por outro do catálogo (contexto tem a lista de ids válidos). Use quando o usuário não tem o aparelho/equipamento, tem dor específica com aquele movimento, ou não gosta. weekday = dia da semana (0=dom..6=sáb) do treino a ajustar. toExerciseId DEVE ser um id exato do catálogo do contexto — nunca invente id.",
          inputSchema: z.object({
            weekday: z.number().min(0).max(6),
            fromExerciseId: z.string().describe("id do exercício atual a substituir"),
            toExerciseId: z.string().describe("id exato do catálogo, do novo exercício"),
          }),
          execute: async ({ weekday, fromExerciseId, toExerciseId }) => {
            actions.push({ type: "swap_exercise", weekday, fromExerciseId, toExerciseId });
            return { ok: true, message: "Exercício trocado no plano." };
          },
        }),
        swap_food: tool({
          description:
            "Troca um alimento da dieta por um substituto equivalente (proteína/carbo similar). Use quando o usuário disser que não tem, acabou ou não gosta de um alimento. O app atualiza o plano e re-mostra o quadro.",
          inputSchema: z.object({
            from: z.string().describe("alimento a remover, ex: purê"),
            to: z
              .string()
              .describe("substituto equivalente com porção, ex: batata cozida (150g)"),
          }),
          execute: async ({ from, to }) => {
            actions.push({ type: "swap_food", from, to });
            return { ok: true, message: `Trocado ${from} por ${to} no plano.` };
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
