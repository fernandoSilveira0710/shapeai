import type { Tone } from "@/lib/types";
import { nowParts } from "@/lib/utils";

export const TONE_META: Record<
  Tone,
  { label: string; blurb: string; preview: string }
> = {
  brother: {
    label: "Brother",
    blurb: "Amigo de quebrada, informal, gíria. Cobra sem humilhar.",
    preview: "E aí meu rei, 18:10, atrasado?! Que que deu?",
  },
  sargento: {
    label: "Sargento",
    blurb: "Militar, cobrança pesada, zero firula.",
    preview: "SOLDADO, 18:10! 20 MINUTOS ATRASADO. ME EXPLICA.",
  },
  nutella: {
    label: "Nutella",
    blurb: "Motivacional leve, positividade, acolhe.",
    preview: "Bom dia! 🌸 Que lindo momento pra cuidar de você.",
  },
  low_profile: {
    label: "Low profile",
    blurb: "Direto, sem bordão. Só o necessário.",
    preview: "18:10. Treino era às 18? Aconteceu algo?",
  },
};

type OpeningCtx = {
  name: string;
  tone: Tone;
  hasWorkoutToday: boolean;
  workoutLabel?: string;
  workoutDoneToday: boolean;
  missedYesterday: boolean;
  pendingWeight: boolean;
  mealDue?: string;
};

export function buildOpening(ctx: OpeningCtx): string {
  const { time, weekday, hour } = nowParts();
  const n = ctx.name.split(" ")[0] || "campeão";

  const say = (brother: string, sargento: string, nutella: string, low: string) => {
    switch (ctx.tone) {
      case "brother":
        return brother;
      case "sargento":
        return sargento;
      case "nutella":
        return nutella;
      default:
        return low;
    }
  };

  if (ctx.missedYesterday && ctx.hasWorkoutToday && !ctx.workoutDoneToday) {
    return say(
      `${time}, ${n}. Ontem furaste. Hoje é ${ctx.workoutLabel}. A gente compensa — bora?`,
      `${time}. ONTEM: FALTA. HOJE: ${ctx.workoutLabel?.toUpperCase()}. SEM DESCULPA BARATA. BORA?`,
      `Oi ${n} 💛 Ontem não rolou, e tudo bem. Hoje temos ${ctx.workoutLabel}. Topa recomeçar comigo?`,
      `${time}. Ontem sem treino. Hoje: ${ctx.workoutLabel}. Vamos?`
    );
  }

  if (ctx.hasWorkoutToday && !ctx.workoutDoneToday && hour >= 16) {
    return say(
      `E aí meu rei, ${time}. Janela de treino — hoje é ${ctx.workoutLabel}. Já tá de roupa?`,
      `${time}. JANELA DE TREINO. HOJE: ${ctx.workoutLabel?.toUpperCase()}. UNIFORME. AGORA.`,
      `Oi ${n}! 💪 ${time} e o treino de ${ctx.workoutLabel} te espera. Bora com calma e presença?`,
      `${time}. Treino: ${ctx.workoutLabel}. Pronto?`
    );
  }

  if (ctx.hasWorkoutToday && !ctx.workoutDoneToday && hour < 12) {
    return say(
      `${weekday}, ${time}. Hoje tem ${ctx.workoutLabel}. Café foi o quê? Depois a gente treina.`,
      `${time}. HOJE HÁ TREINO: ${ctx.workoutLabel?.toUpperCase()}. REPORTA O CAFÉ. DEPOIS TREINA.`,
      `Bom dia, ${n}! 🌸 Hoje o plano é ${ctx.workoutLabel}. Como foi o café?`,
      `${time}. Hoje: ${ctx.workoutLabel}. Café?`
    );
  }

  if (ctx.workoutDoneToday) {
    return say(
      `${time}. Treino já foi — respeitei. Agora comida e água, ${n}. Já almoçou/jantou?`,
      `${time}. TREINO CONCLUÍDO. PRÓXIMA MISSÃO: REFEIÇÃO. REPORTA.`,
      `Você treinou hoje, ${n}! ✨ Agora cuida da comida. Já se alimentou?`,
      `${time}. Treino ok. Refeição?`
    );
  }

  if (ctx.pendingWeight) {
    return say(
      `${weekday} ${time}. Semana nova, balança. Manda o número (mesmo horário se der).`,
      `${time}. PESAGEM SEMANAL. NÚMERO. AGORA.`,
      `Oi! 🌿 Dia de olhar o peso com carinho — sem drama. Pode me mandar?`,
      `${time}. Peso da semana?`
    );
  }

  if (hour >= 11 && hour <= 14) {
    return say(
      `${time}. Almoço, ${n}. Já comeu? Me conta o prato.`,
      `${time}. REFEIÇÃO 2 (ALMOÇO). REPORTA.`,
      `Hora do almoço 🥗 Como está o prato de hoje?`,
      `${time}. Almoço?`
    );
  }

  if (hour >= 18 && hour <= 21) {
    return say(
      `${time}. Janta no radar. O que vai ser?`,
      `${time}. JANTAR. O QUE ENTRA NO PRATO?`,
      `Noite chegando 🌙 Já pensou na janta?`,
      `${time}. Janta?`
    );
  }

  if (!ctx.hasWorkoutToday) {
    return say(
      `${time}, rest day. Anda, sol, água. Sem culpa — e sem virar o dia só no pão com mortadela kk`,
      `${time}. DESCANSO ATIVO. HIDRATA. NÃO É FERIADO DA DISCIPLINA.`,
      `Dia de descanso merecido, ${n} 💛 Cuida do corpo com carinho.`,
      `${time}. Descanso. Água. Caminhada leve se der.`
    );
  }

  return say(
    `E aí ${n}, ${time}. Tô aqui. Treino, comida ou só desabafar a semana?`,
    `${time}. ONLINE. QUAL A ORDEM: TREINO, COMIDA OU STATUS?`,
    `Oi ${n}! ✨ Que bom te ver. Como posso te ajudar agora?`,
    `${time}. O que precisa?`
  );
}

export function coachReply(
  tone: Tone,
  userText: string,
  kind:
    | "ack_meal"
    | "start_workout"
    | "skip"
    | "weight"
    | "generic"
    | "greeting"
    | "plan_ok"
    | "water"
    | "workout_done"
    | "paywall_vision",
  extra?: string
): string {
  const t = userText.toLowerCase();
  const say = (b: string, s: string, n: string, l: string) => {
    switch (tone) {
      case "brother":
        return b;
      case "sargento":
        return s;
      case "nutella":
        return n;
      default:
        return l;
    }
  };

  switch (kind) {
    case "ack_meal":
      return say(
        `Fechou. ${extra ?? "Anotado."} Próxima refeição a gente ajusta se precisar.`,
        `REGISTRADO. ${extra ?? ""} PRÓXIMA REFEIÇÃO NO HORÁRIO.`,
        `Obrigada por me contar! ${extra ?? ""} Você está se cuidando 💛`,
        `Ok. ${extra ?? "Logado."}`
      );
    case "start_workout":
      return say(
        `Isso aí. Abri o treino — bora série por série. Eu conto o descanso.`,
        `SESSÃO INICIADA. EXECUÇÃO. SEM ENROLAÇÃO.`,
        `Vamos juntos! 💪 Respeita o descanso e escuta o corpo.`,
        `Treino aberto. Primeiro exercício.`
      );
    case "skip":
      return say(
        `Beleza, vida acontece. ${extra ?? "A gente remonta."} Só não some, meu rei.`,
        `FALTA REGISTRADA. ${extra ?? "REPOSIÇÃO OBRIGATÓRIA."}`,
        `Tudo bem descansar quando precisa. ${extra ?? "Quando quiser, eu remonto com carinho."}`,
        `Skip ok. ${extra ?? "Reagenda quando der."}`
      );
    case "weight":
      return say(
        `Peso ${extra}. Anotei. A gente olha a tendência, não um dia só.`,
        `PESO ${extra} REGISTRADO. EVOLUÇÃO > VAIDADE DIÁRIA.`,
        `${extra} kg — obrigada! 🌿 O importante é a curva com o tempo.`,
        `${extra} kg salvo.`
      );
    case "plan_ok":
      return say(
        `Plano fechado. A partir de agora eu te cobro em cima disso. Bora viver.`,
        `PLANO TRAVADO. EXECUÇÃO DIÁRIA COMEÇA AGORA.`,
        `Que lindo acordo a gente fez! ✨ Estou contigo no dia a dia.`,
        `Plano salvo. Seguimos.`
      );
    case "water":
      return say(
        `Água, meu rei. Garganta pedindo e tu fingindo que não.`,
        `HIDRATAÇÃO. AGORA.`,
        `Um gole de água faz bem 💧`,
        `Água.`
      );
    case "workout_done":
      return say(
        `Boa. ${extra ?? "Treino fechado."} Amanhã a gente continua — não falha.`,
        `SESSÃO ENCERRADA. ${extra ?? ""} AMANHÃ NO HORÁRIO.`,
        `Mandou bem demais! 🎉 ${extra ?? ""} Descanso e comida agora.`,
        `Fim. ${extra ?? "Salvo."}`
      );
    case "greeting":
      return say(
        `Salve! ${extra ?? ""} Que que manda — treino, comida ou só papo?`,
        `NA ESCUTA. ${extra?.toUpperCase() ?? ""} AGUARDANDO ORDEM.`,
        `Oi! 😊 Que bom te ver. ${extra ?? ""} Como você tá?`,
        `Oi. ${extra ?? ""}`
      );
    case "paywall_vision":
      return say(
        `Foto do prato é no Pro, brother. No Básico tu me descreve que eu te leio igual.`,
        `VISÃO DE PRATO: PLANO PRO. NO BÁSICO: DESCREVA O PRATO.`,
        `A análise por foto mora no Pro 📸 Enquanto isso, me conta o que comeu?`,
        `Vision = Pro. Descreve o prato por texto.`
      );
    default:
      if (/bora|vamos|treino|começar|iniciar/.test(t)) {
        return coachReply(tone, userText, "start_workout");
      }
      return say(
        extra ??
          `Tô contigo. Me fala se é treino, comida, peso ou se quer mudar o plano.`,
        extra ?? `AGUARDANDO ORDEM CLARA: TREINO / COMIDA / PESO / PLANO.`,
        extra ?? `Estou aqui 💛 Pode falar de treino, comida ou como você está.`,
        extra ?? `Treino, refeição, peso ou plano?`
      );
  }
}
