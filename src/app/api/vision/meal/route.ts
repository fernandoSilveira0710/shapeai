import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextRequest, NextResponse } from "next/server";

/**
 * Análise de foto de prato (Pro).
 * Espera { imageDataUrl, tone, planSummary?, caption? }
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        fallback: true,
        text: null,
        analysis: null,
        message:
          "Vision precisa de OPENAI_API_KEY no servidor. Por ora descreva o prato em texto.",
      },
      { status: 503 }
    );
  }

  const body = await req.json();
  const {
    imageDataUrl,
    tone = "brother",
    planSummary = "",
    caption = "",
  }: {
    imageDataUrl?: string;
    tone?: string;
    planSummary?: string;
    caption?: string;
  } = body;

  if (!imageDataUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "imageDataUrl inválida" }, { status: 400 });
  }

  // limite ~1.5MB data URL
  if (imageDataUrl.length > 2_000_000) {
    return NextResponse.json(
      { error: "Imagem grande demais. Comprime e tenta de novo." },
      { status: 413 }
    );
  }

  const openai = createOpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

  const system = `Você é o Shape, personal+nutri no bolso (Brasil).
Tom: ${tone} (brother / sargento / nutella / low_profile).
Analise a FOTO de refeição. Seja honesto com incerteza de porção.
Não moralize. Não invente kcal exata — use ranges se arriscar.
Responda em PT-BR, 3-6 frases no tom, no celular.
No final, em uma linha separada: SCORE: N/10 (aderência ao plano).
Plano do aluno: ${planSummary || "não informado"}
Legenda do user: ${caption || "(sem legenda)"}`;

  try {
    const { text } = await generateText({
      model: openai(model),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: system },
            { type: "image", image: imageDataUrl },
          ],
        },
      ],
    });

    return NextResponse.json({
      text: text.trim(),
      fallback: false,
    });
  } catch (e) {
    console.error("vision meal error", e);
    return NextResponse.json(
      { error: "Vision failed", fallback: true, text: null },
      { status: 502 }
    );
  }
}
