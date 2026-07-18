import type { Plan, Tone, UserProfile } from "@/lib/types";
import { WEEKDAY_LABELS } from "@/lib/plan-generator";
import { nowParts } from "@/lib/utils";

export type IntakeNote = {
  key: string;
  question: string;
  answer: string;
  at: string;
};

export type IntakeQuestion = {
  key: string;
  /** texto da pergunta no tom */
  ask: (tone: Tone, name: string) => string;
  /** por que o personal se importa */
  metricLabel: string;
};

function say(tone: Tone, b: string, s: string, n: string, l: string) {
  switch (tone) {
    case "sargento":
      return s;
    case "nutella":
      return n;
    case "low_profile":
      return l;
    default:
      return b;
  }
}

function goalLabel(g: UserProfile["goal"]) {
  const map: Record<UserProfile["goal"], string> = {
    hipertrofia: "ganhar músculo (hipertrofia)",
    emagrecimento: "emagrecer com consistência",
    definicao: "definição / recomposição",
    condicionamento: "condicionamento e saúde",
    manutencao: "manutenção",
  };
  return map[g] ?? g;
}

function dayList(profile: UserProfile) {
  return profile.trainDays
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

function splitSummary(plan: Plan) {
  return plan.workoutDays
    .filter((d) => !d.isRest)
    .map((d) => `${WEEKDAY_LABELS[d.weekday]}: ${d.label} (${d.exercises.length} ex.)`)
    .join("\n");
}

/** Sinais do cadastro → perguntas de aprofundamento (métricas pro personal) */
export function buildIntakeQueue(profile: UserProfile): IntakeQuestion[] {
  const q: IntakeQuestion[] = [];

  // sempre: motivação / realidade
  q.push({
    key: "why_now",
    metricLabel: "Motivação e momento de vida",
    ask: (tone, name) =>
      say(
        tone,
        `${name}, me fala a real: por que agora? O que te fez abrir o Shape hoje — estética, saúde, raiva do espelho, prova, ex?`,
        `${name.toUpperCase()}. MOTIVO DA MISSÃO. POR QUE AGORA? SEM DISCURSO BONITO.`,
        `${name}, com carinho: o que te trouxe pra cá agora? 💛 Quero entender teu “porquê”.`,
        `${name}. Por que começou agora?`
      ),
  });

  if (profile.trainDurationMin <= 35) {
    q.push({
      key: "duration_short",
      metricLabel: "Janela de treino curta — motivo",
      ask: (tone, name) =>
        say(
          tone,
          `Vi que tu botou só ${profile.trainDurationMin} min. É falta de tempo de verdade (trampo, filho, trânsito) ou tu acha que mais que isso cansa? Me explica — isso muda o split inteiro.`,
          `DURAÇÃO: ${profile.trainDurationMin} MIN. JUSTIFICATIVA. TEMPO REAL OU DESCULPA?`,
          `Notei ${profile.trainDurationMin} minutinhos ⏱ É o máximo que a rotina deixa, ou prefere treinos curtos? Sem julgamento.`,
          `${profile.trainDurationMin} min por sessão. Por quê?`
        ),
    });
  } else if (profile.trainDurationMin >= 75) {
    q.push({
      key: "duration_long",
      metricLabel: "Janela longa — sustentabilidade",
      ask: (tone) =>
        say(
          tone,
          `${profile.trainDurationMin} min é generoso. Consegue sustentar isso 4+ semanas ou nos dias ruins cai pra 40? Prefiro plano honesto.`,
          `${profile.trainDurationMin} MIN PLANEJADOS. SUSTENTÁVEL OU ILUSÃO? RESPONDA.`,
          `${profile.trainDurationMin} min é lindo se for real 💪 Nos dias caóticos, quanto sobra de verdade?`,
          `${profile.trainDurationMin} min é realista todo dia de treino?`
        ),
    });
  }

  if (profile.trainDays.length >= 5) {
    q.push({
      key: "high_frequency",
      metricLabel: "Frequência alta — risco de abandono",
      ask: (tone) =>
        say(
          tone,
          `${profile.trainDays.length} dias na semana é pesado. Já manteve isso antes ou é o plano “ideal no papel”? Se furar 1, prefere enxugar o split ou empurrar o treino?`,
          `FREQUÊNCIA: ${profile.trainDays.length}X. HISTÓRICO DE ADERÊNCIA? SE FALTAR, CORTA VOLUME OU REPOSIÇÃO?`,
          `${profile.trainDays.length}x/semana é ambicioso ✨ Já rolou contigo? Se a vida apertar, o que prefere: menos dias ou treinos mais curtos?`,
          `${profile.trainDays.length} dias/semana. Já manteve? Se faltar, o que prefere?`
        ),
    });
  } else if (profile.trainDays.length <= 2) {
    q.push({
      key: "low_frequency",
      metricLabel: "Frequência baixa — expectativa de resultado",
      ask: (tone) =>
        say(
          tone,
          `Só ${profile.trainDays.length} dias. Dá pra evoluir, mas devagar. Tá ok com ritmo de tartaruga firme, ou a gente tenta achar +1 dia escondido na semana?`,
          `FREQUÊNCIA BAIXA: ${profile.trainDays.length}X. ACEITA RITMO LENTO OU CAÇA MAIS UM DIA?`,
          `Com ${profile.trainDays.length} dias a gente respeita tua vida 💛 Resultado vem mais devagar — topa, ou tem um dia extra possível?`,
          `${profile.trainDays.length}x/semana. Ok com ritmo lento ou quer tentar +1 dia?`
        ),
    });
  }

  const inj = (profile.injuries || "").toLowerCase();
  if (inj && !/nenhum|nada|n\/a|sem /.test(inj) && inj.length > 2) {
    q.push({
      key: "injury_detail",
      metricLabel: "Lesão/restrição — detalhe clínico-prático",
      ask: (tone) =>
        say(
          tone,
          `Tu citou: “${profile.injuries}”. Isso dói em movimento específico, é diagnóstico médico, ou precaução? Me fala o que NÃO pode (agachamento, corrida, elevação…) pra eu não te foder no treino.`,
          `RESTRIÇÃO REGISTRADA: “${profile.injuries.toUpperCase()}”. LIMITES ABSOLUTOS. O QUE É PROIBIDO?`,
          `Sobre “${profile.injuries}” 🤍 Me conta o que evita e o que ainda vai bem, pra montar com segurança.`,
          `Restrição: ${profile.injuries}. O que é proibido no treino?`
        ),
    });
  }

  if (profile.budgetFood === "apertado") {
    q.push({
      key: "food_reality",
      metricLabel: "Orçamento alimentar real",
      ask: (tone) =>
        say(
          tone,
          `Orçamento apertado — respeito. Come mais em casa ou na rua? Tem algo que recusa de vez (ovo, frango, feijão, whey…)?`,
          `ORÇAMENTO APERADO. ONDE COME? ALIMENTO BLOQUEADO? REPORTA.`,
          `Sobre comida e bolso 🍀 Onde você mais come, e tem algum alimento que não rola de jeito nenhum?`,
          `Orçamento apertado. Come em casa ou fora? Algum alimento off?`
        ),
    });
  }

  if (profile.workType === "turnos" || profile.workType === "presencial") {
    q.push({
      key: "schedule_friction",
      metricLabel: "Fricção de rotina (trabalho)",
      ask: (tone) =>
        say(
          tone,
          `Trabalho ${profile.workType} costuma matar treino. Qual horário é sagrado (tipo 19h) e qual dia mais fura? Quero montar a semana no teu caos real, não no ideal.`,
          `TRABALHO: ${profile.workType.toUpperCase()}. HORÁRIO INEGOCIÁVEL E DIA QUE MAIS FALHA. FALA.`,
          `Com trampo ${profile.workType}, a vida manda 😅 Qual horário costuma funcionar e qual dia mais escorrega?`,
          `Trabalho ${profile.workType}. Melhor horário e pior dia da semana?`
        ),
    });
  }

  if (profile.experience === "iniciante") {
    q.push({
      key: "beginner_expect",
      metricLabel: "Expectativa de iniciante",
      ask: (tone) =>
        say(
          tone,
          `Iniciante no jogo — ótimo. Em 8 semanas, o que seria vitória pra ti: hábito, força, roupa servindo, número na balança?`,
          `NÍVEL: INICIANTE. VITÓRIA EM 8 SEMANAS — DEFINA EM UMA FRASE.`,
          `Começando é especial 🌱 Em 2 meses, o que te faria sorrir de verdade?`,
          `Iniciante. Vitória em 8 semanas = o quê?`
        ),
    });
  }

  if (profile.goal === "hipertrofia") {
    q.push({
      key: "hyper_appetite",
      metricLabel: "Adesão alimentar hipertrofia",
      ask: (tone) =>
        say(
          tone,
          `Hipertrofia pede comer bem (proteína). Tu come com fome de sobra ou é daqueles que esquece de almoçar?`,
          `OBJETIVO HIPERTROFIA. APETITE E REGULARIDADE DE REFEIÇÃO: QUAL SEU PADRÃO?`,
          `Pra crescer, comida é parte do treino 🍽️ Como tá tua fome e regularidade no dia?`,
          `Hipertrofia. Come regular ou esquece refeição?`
        ),
    });
  }

  // fecha com opinião sobre o split proposto
  q.push({
    key: "split_opinion",
    metricLabel: "Aprovação do split proposto",
    ask: (tone) =>
      say(
        tone,
        `Olhando a divisão que montei — faz sentido na tua cabeça ou tem dia que tu já sabe que vai furar? Pode mandar: “tira sexta”, “quero mais perna”, “full body”.`,
        `AVALIE O SPLIT. ACEITA, REJEITA OU AJUSTA. ORDEM CLARA.`,
        `Essa divisão te parece leve de seguir? 💫 Pode pedir mudança sem medo.`,
        `O split te serve? Quer mudar algum dia?`
      ),
  });

  // no máximo 5 perguntas pra não virar interrogatório
  return q.slice(0, 5);
}

/**
 * Intro do primeiro contato: UMA mensagem curta, humana, terminando na
 * primeira pergunta. Sem despejo de cadastro (isso é memória da IA, não fala),
 * sem meta-papo de "tom que tu escolheu".
 */
export function buildIntroMessage(profile: UserProfile): string {
  const name = profile.displayName.split(" ")[0] || "campeão";
  return say(
    profile.tone,
    `E aí ${name}! 👊 Primeira vez por aqui, então me apresento: sou teu personal de bolso. Antes de sair jogando treino, quero te conhecer de verdade — pode falar natural comigo, tipo conversa mesmo.\n\nComeça me contando: o que te trouxe aqui agora?`,
    `${name.toUpperCase()}. AQUI É O SHAPE, SEU TREINADOR. ANTES DO PRIMEIRO TREINO: RECONHECIMENTO. PERGUNTAS CURTAS, RESPOSTAS FRANCAS.\n\nPRIMEIRA: POR QUE AGORA?`,
    `Oi ${name}! 🌸 Que alegria te receber. Eu sou teu personal de bolso — e antes de qualquer treino, quero te conhecer de verdade. Fala comigo do teu jeito, tá?\n\nMe conta: o que te trouxe até aqui agora?`,
    `${name}. Sou teu personal. Antes do treino, preciso te conhecer.\n\nPrimeira pergunta: por que agora?`
  );
}

/** Mensagens iniciais do primeiro contato (antes das perguntas) */
export function buildFirstContactScript(
  profile: UserProfile,
  plan: Plan
): { text: string; rich?: { type: "plan_summary"; title: string; body: string; cta?: string } }[] {
  const tone = profile.tone;
  const name = profile.displayName.split(" ")[0] || "campeão";
  const { time } = nowParts();
  const nTrain = plan.workoutDays.filter((d) => !d.isRest).length;
  const split = splitSummary(plan);

  const intro = say(
    tone,
    `E aí ${name}, ${time}. Aqui é teu Shape — no tom que tu escolheu. Não vim jogar ficha fria: li o que tu preencheu e quero montar contigo, não pra ti.`,
    `${time}. ${name.toUpperCase()}. AQUI É O SHAPE. TOM: SARGENTO. LI SEU DOSSIÊ. VAMOS CONSTRUIR O PLANO COM PRECISÃO — NÃO COM FANTASIA.`,
    `Oi ${name} ✨ ${time}. Que bom te ter aqui. Eu li tudo que você contou e quero conversar de verdade antes da gente só “mandar treino”.`,
    `${time}. ${name}. Li teu cadastro. Vamos alinhar o plano com a vida real.`
  );

  const readback = say(
    tone,
    `Resumo do que entendi:\n• Objetivo: ${goalLabel(profile.goal)}\n• ${profile.experience} · ${profile.equipment.join(", ") || "equipamento a definir"}\n• ${nTrain} dias (${dayList(profile)}) · ~${profile.trainDurationMin} min\n• Trabalho: ${profile.workType} · comida: orçamento ${profile.budgetFood}\n• Lesões/obs: ${profile.injuries || "nenhuma"}\n• Meta ~${plan.nutrition.kcal} kcal · P${plan.nutrition.proteinG}g\n\nSe algo tá errado, corrige agora.`,
    `DOSSIÊ:\n• MISSÃO: ${goalLabel(profile.goal).toUpperCase()}\n• NÍVEL: ${profile.experience.toUpperCase()}\n• FREQUÊNCIA: ${nTrain}X (${dayList(profile)}) · ${profile.trainDurationMin} MIN\n• CONTEXTO: ${profile.workType.toUpperCase()} · ORÇAMENTO ${profile.budgetFood.toUpperCase()}\n• RESTRIÇÕES: ${(profile.injuries || "NENHUMA").toUpperCase()}\n• NUTRI: ~${plan.nutrition.kcal} KCAL · P${plan.nutrition.proteinG}G\n\nCONFIRME OU CORRIJA.`,
    `Deixa eu espelhar o que entendi 🪞\n• Objetivo: ${goalLabel(profile.goal)}\n• ${profile.experience}, treina em ${profile.equipment.join(", ")}\n• ${nTrain} dias (${dayList(profile)}), uns ${profile.trainDurationMin} min\n• Rotina: ${profile.workType}, orçamento ${profile.budgetFood}\n• Cuidados: ${profile.injuries || "nenhum"}\n• Comida: ~${plan.nutrition.kcal} kcal, proteína ${plan.nutrition.proteinG}g\n\nTá parecido com você?`,
    `Cadastro:\n• ${goalLabel(profile.goal)}\n• ${profile.experience} · ${nTrain}x (${dayList(profile)}) · ${profile.trainDurationMin}min\n• ${profile.workType} · orçamento ${profile.budgetFood}\n• ${profile.injuries || "sem lesão"}\n• ~${plan.nutrition.kcal} kcal\nCorrige se precisar.`
  );

  const splitMsg = say(
    tone,
    `Proposta de divisão da semana (rascunho — a gente briga e ajusta):\n${split}\n\nLógica: encaixar volume no teu objetivo (${goalLabel(profile.goal)}) sem inventar 2h de academia se tua vida não tem.`,
    `SPLIT PROPOSTO (RASCUNHO):\n${split}\n\nCRITÉRIO: OBJETIVO ${goalLabel(profile.goal).toUpperCase()} + SEUS DIAS. NÃO É LEI AINDA.`,
    `Pensei nessa divisão pra começar 🗺️\n${split}\n\nÉ rascunho carinhoso — a gente molda juntos.`,
    `Split proposto:\n${split}\nRascunho. Ajustamos.`
  );

  const bridge = say(
    tone,
    `Antes de gritar “bora treinar”, preciso de umas respostas curtas. Isso vira teu dossiê — inclusive pro personal humano se um dia tu vincular academia. Pode mandar no texto livre.`,
    `ANTES DA EXECUÇÃO: INTERROGATÓRIO CURTO. RESPOSTAS OBJETIVAS. VAI PRO DOSSIÊ.`,
    `Antes do primeiro treino, umas perguntinhas 💬 Suas respostas me ajudam (e ajudam um personal de verdade, se entrar no app).`,
    `Algumas perguntas curtas antes do treino. Responde no teu ritmo.`
  );

  return [
    { text: intro },
    { text: readback },
    {
      text: splitMsg,
      rich: {
        type: "plan_summary",
        title: `Rascunho · ${nTrain} dias · ~${plan.nutrition.kcal} kcal`,
        body: plan.workoutDays
          .filter((d) => !d.isRest)
          .map((d) => `${WEEKDAY_LABELS[d.weekday]} ${d.label}`)
          .join(" · "),
        cta: "Ver no perfil",
      },
    },
    { text: bridge },
  ];
}

export function intakeClosing(tone: Tone, name: string): string {
  const n = name.split(" ")[0] || "campeão";
  return say(
    tone,
    `Fechou, ${n}. Anotei tudo no teu dossiê. A partir de agora eu te cobro em cima dessa real — não do Instagram. Quando quiser, manda “bora” e a gente entra no treino do dia. Se quiser mudar split/comida, é só falar.`,
    `DOSSIÊ COMPLETO, ${n.toUpperCase()}. FIM DA ENTREVISTA. COMANDO “BORA” INICIA O TREINO. AJUSTES: FALE.`,
    `Obrigada por abrir o jogo, ${n} ✨ Guardei tudo com carinho. Quando quiser treinar, é só dizer “bora”. E pode pedir mudança de plano quando precisar.`,
    `Dossiê ok. Manda “bora” pro treino do dia, ou pede ajuste no plano.`
  );
}

/** Chips sugeridos na fase de intake */
export function intakeChips(key: string | null): string[] {
  switch (key) {
    case "duration_short":
      return ["Tempo real de trampo", "Prefiro curto e intenso", "Posso tentar 45 min"];
    case "high_frequency":
      return ["Já mantive 5x", "É o ideal, não a real", "Prefiro enxugar se faltar"];
    case "low_frequency":
      return ["Ritmo lento ok", "Quero achar +1 dia", "2x é o teto"];
    case "injury_detail":
      return ["Só precaução", "Dói em exercício X", "Liberado pelo médico"];
    case "split_opinion":
      return ["Split ok", "Tira um dia", "Quero mais perna", "Prefiro full body"];
    case "why_now":
      return ["Estética", "Saúde", "Disciplina", "Evento / data"];
    default:
      return ["Pode perguntar", "Quero ajustar o plano", "Bora treinar depois"];
  }
}
