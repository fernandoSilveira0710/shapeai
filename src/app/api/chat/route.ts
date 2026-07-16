import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

/**
 * Optional LLM endpoint. App works without OPENAI_API_KEY (client rule-based coach).
 * When key is set, client can POST here for richer replies.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "LLM not configured", fallback: true },
      { status: 503 }
    );
  }

  const body = await req.json();
  const {
    message,
    tone = "brother",
    context = "",
  }: { message: string; tone?: string; context?: string } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  const system = `Você é o Shape, personal trainer + nutri no bolso, brasileiro.
Tom ativo: ${tone} (brother=gíria amigável; sargento=ordem militar; nutella=leve positivo; low_profile=seco).
Regras: PT-BR, 2-5 frases no celular, sem diagnóstico médico, sem humilhar corpo, sem incentivar TCA.
Contexto do usuário:
${context || "(sem contexto extra)"}
Responda só a fala do personal, sem markdown pesado.`;

  try {
    const { text } = await generateText({
      model: openai(model),
      system,
      prompt: message,
    });
    return NextResponse.json({ text });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "LLM failed", fallback: true },
      { status: 502 }
    );
  }
}
