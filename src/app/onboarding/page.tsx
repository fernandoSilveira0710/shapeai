"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Chip, Input, Label, ProgressBar, Textarea } from "@/components/ui";
import { TONE_META } from "@/lib/tone";
import type { Equipment, Goal, Tone, UserProfile } from "@/lib/types";
import { generatePlanFromProfile, useAppStore } from "@/store/app-store";
import { WEEKDAY_LABELS } from "@/lib/plan-generator";

const GOALS: { id: Goal; title: string; blurb: string }[] = [
  {
    id: "hipertrofia",
    title: "Hipertrofia",
    blurb: "Ganhar músculo e volume. Proteína alta, força progressiva. Não é secar em 2 semanas.",
  },
  {
    id: "emagrecimento",
    title: "Emagrecimento",
    blurb: "Perder gordura com déficit controlado. Mantém músculo com treino. Não é jejum extremo.",
  },
  {
    id: "definicao",
    title: "Definição",
    blurb: "Recomposição: músculo + menos gordura. Mais lento; exige consistência.",
  },
  {
    id: "condicionamento",
    title: "Condicionamento",
    blurb: "Fôlego e saúde geral. Força + densidade. Ideal pra quem sumiu da academia.",
  },
  {
    id: "manutencao",
    title: "Manutenção",
    blurb: "Manter o que tem, rotina sustentável sem obsessão.",
  },
];

const EQUIPMENT: { id: Equipment; label: string }[] = [
  { id: "academia", label: "Academia completa" },
  { id: "halteres", label: "Halteres em casa" },
  { id: "peso_corporal", label: "Só o corpo" },
  { id: "casa", label: "Casa (misto)" },
  { id: "parque", label: "Parque / barra" },
];

const WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

export default function OnboardingPage() {
  const router = useRouter();
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [weightKg, setWeightKg] = useState("78");
  const [heightCm, setHeightCm] = useState("175");
  const [age, setAge] = useState("28");
  const [goal, setGoal] = useState<Goal>("hipertrofia");
  const [experience, setExperience] =
    useState<UserProfile["experience"]>("intermediario");
  const [equipment, setEquipment] = useState<Equipment[]>(["academia"]);
  const [injuries, setInjuries] = useState("");
  const [workType, setWorkType] = useState("presencial");
  const [budgetFood, setBudgetFood] =
    useState<UserProfile["budgetFood"]>("ok");
  const [restrictions, setRestrictions] = useState("");
  const [cooksAtHome, setCooksAtHome] = useState(true);
  const [trainDays, setTrainDays] = useState<number[]>([1, 3, 5]);
  const [duration, setDuration] = useState(60);
  const [tone, setTone] = useState<Tone>("brother");
  const [consent, setConsent] = useState(false);
  const [draftPlan, setDraftPlan] = useState<ReturnType<
    typeof generatePlanFromProfile
  > | null>(null);

  const totalSteps = 8;
  const progress = ((step + 1) / totalSteps) * 100;

  // validação corpo (spec: peso 30–300, altura 100–250, 18+)
  const ageN = Number(age);
  const weightValid = Number(weightKg) >= 30 && Number(weightKg) <= 300;
  const heightValid = Number(heightCm) >= 100 && Number(heightCm) <= 250;
  const ageValid = ageN >= 18 && ageN <= 100;
  const underage = age.trim() !== "" && ageN > 0 && ageN < 18;
  const bodyValid = weightValid && heightValid && ageValid;

  const profileDraft = useMemo((): UserProfile => {
    return {
      id: crypto.randomUUID(),
      displayName: displayName.trim() || "Atleta",
      email: "demo@shape.ai",
      weightKg: Number(weightKg) || 70,
      heightCm: Number(heightCm) || 170,
      age: Number(age) || 25,
      goal,
      experience,
      equipment,
      injuries: injuries.trim() || "Nenhuma",
      workType,
      budgetFood,
      dietRestrictions: restrictions
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      cooksAtHome,
      trainDays,
      trainDurationMin: duration,
      tone,
      onboardingCompleted: true,
      createdAt: new Date().toISOString(),
    };
  }, [
    displayName,
    weightKg,
    heightCm,
    age,
    goal,
    experience,
    equipment,
    injuries,
    workType,
    budgetFood,
    restrictions,
    cooksAtHome,
    trainDays,
    duration,
    tone,
  ]);

  function toggleDay(d: number) {
    setTrainDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  function toggleEq(id: Equipment) {
    setEquipment((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function goGenerate() {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 900));
    setDraftPlan(generatePlanFromProfile(profileDraft));
    setGenerating(false);
    setStep(7);
  }

  function finish() {
    if (!draftPlan) return;
    completeOnboarding(profileDraft, draftPlan);
    router.replace("/chat");
  }

  return (
    <div className="app-shell">
      <header className="px-5 pt-6 pb-3 space-y-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-brand">Shape.ai</span>
          <span className="text-xs text-muted">
            {step + 1}/{totalSteps}
          </span>
        </div>
        <ProgressBar value={progress} />
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">
        {step === 0 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Bora te conhecer</h1>
            <p className="text-muted text-sm">
              Isso vira a base do teu personal. Dá pra mudar depois.
            </p>
            <div>
              <Label>Como te chamo no dia a dia?</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: Rafa"
                autoFocus
              />
            </div>
            <label className="flex gap-3 items-start text-sm text-muted">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 accent-[var(--brand-primary)]"
              />
              <span>
                Entendo que o Shape não substitui médico/nutricionista clínico e
                aceito o uso dos meus dados de treino neste dispositivo.
              </span>
            </label>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Corpo agora</h1>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Peso (kg)</Label>
                <Input value={weightKg} onChange={(e) => setWeightKg(e.target.value)} inputMode="decimal" />
              </div>
              <div>
                <Label>Altura (cm)</Label>
                <Input value={heightCm} onChange={(e) => setHeightCm(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <Label>Idade</Label>
                <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" />
              </div>
            </div>
            <p className="text-xs text-muted">
              Usamos pra montar carga e macros — não pra te julgar.
            </p>
            {underage && (
              <p className="text-sm text-warning rounded-xl bg-warning/10 border border-warning/30 p-3">
                Por enquanto o Shape é 18+. Em breve teremos um fluxo com
                responsável — valeu por chegar cedo. 💛
              </p>
            )}
          </section>
        )}

        {step === 2 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Qual teu objetivo?</h1>
            <div className="space-y-2">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition ${
                    goal === g.id
                      ? "border-brand bg-brand/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="font-semibold">{g.title}</div>
                  <div className="text-sm text-muted mt-1">{g.blurb}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Experiência e equipamento</h1>
            <div>
              <Label>Nível</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["iniciante", "Iniciante"],
                    ["intermediario", "Intermediário"],
                    ["avancado", "Avançado"],
                  ] as const
                ).map(([id, label]) => (
                  <Chip key={id} active={experience === id} onClick={() => setExperience(id)}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Onde treina?</Label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.map((e) => (
                  <Chip
                    key={e.id}
                    active={equipment.includes(e.id)}
                    onClick={() => toggleEq(e.id)}
                  >
                    {e.label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Lesões ou restrições</Label>
              <Textarea
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                placeholder="Ex: joelho esquerdo sensível, ou 'nenhuma'"
              />
            </div>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Tua rotina real</h1>
            <p className="text-sm text-muted">
              Plano bom respeita o dia que você tem — não o ideal do Instagram.
            </p>
            <div>
              <Label>Trabalho</Label>
              <div className="flex flex-wrap gap-2">
                {["não", "home office", "presencial", "turnos"].map((w) => (
                  <Chip key={w} active={workType === w} onClick={() => setWorkType(w)}>
                    {w}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Orçamento comida</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["apertado", "Apertado"],
                    ["ok", "Ok"],
                    ["folgado", "Folgado"],
                  ] as const
                ).map(([id, label]) => (
                  <Chip
                    key={id}
                    active={budgetFood === id}
                    onClick={() => setBudgetFood(id)}
                  >
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Restrições alimentares (separe por vírgula)</Label>
              <Input
                value={restrictions}
                onChange={(e) => setRestrictions(e.target.value)}
                placeholder="lactose, vegetariano, odeio fígado…"
              />
            </div>
            <div>
              <Label>Cozinha em casa?</Label>
              <div className="flex gap-2">
                <Chip active={cooksAtHome} onClick={() => setCooksAtHome(true)}>
                  Sim
                </Chip>
                <Chip active={!cooksAtHome} onClick={() => setCooksAtHome(false)}>
                  Pouco / como fora
                </Chip>
              </div>
            </div>
          </section>
        )}

        {step === 5 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Grade de treino</h1>
            <div>
              <Label>Quais dias?</Label>
              <div className="flex flex-wrap gap-2">
                {WEEK_DAYS.map((d) => (
                  <Chip key={d} active={trainDays.includes(d)} onClick={() => toggleDay(d)}>
                    {WEEKDAY_LABELS[d]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <Label>Duração preferida</Label>
              <div className="flex flex-wrap gap-2">
                {[30, 45, 60, 75].map((m) => (
                  <Chip key={m} active={duration === m} onClick={() => setDuration(m)}>
                    {m} min
                  </Chip>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 6 && (
          <section className="space-y-4 animate-rise">
            <h1 className="text-2xl font-bold">Tom do teu personal</h1>
            <p className="text-sm text-muted">Isso muda a cobrança — não a ciência do plano.</p>
            <div className="space-y-2">
              {(Object.keys(TONE_META) as Tone[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTone(t)}
                  className={`w-full text-left rounded-2xl border p-4 transition ${
                    tone === t ? "border-brand bg-brand/10" : "border-border bg-surface"
                  }`}
                >
                  <div className="font-semibold">{TONE_META[t].label}</div>
                  <div className="text-sm text-muted mt-1">{TONE_META[t].blurb}</div>
                  <div className="text-sm text-brand mt-2 italic">
                    “{TONE_META[t].preview}”
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 7 && draftPlan && (
          <section className="flex flex-col items-center justify-center text-center h-full py-16 space-y-5 animate-rise">
            <div className="size-16 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-bold">
              Pronto, {displayName.split(" ")[0] || "atleta"}!
            </h1>
            <p className="text-sm text-muted max-w-[30ch] leading-relaxed">
              Montei um rascunho com o que você me contou. Agora vem a parte boa:
              a gente <span className="text-ink font-medium">conversa</span> e
              fecha treino e comida do teu jeito — no papo mesmo.
            </p>
          </section>
        )}
      </div>

      <footer className="p-5 border-t border-border space-y-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {step < 6 && (
          <Button
            className="w-full"
            size="lg"
            disabled={
              (step === 0 && (!displayName.trim() || !consent)) ||
              (step === 1 && !bodyValid) ||
              (step === 5 && trainDays.length < 2)
            }
            onClick={() => setStep((s) => s + 1)}
          >
            Continuar
          </Button>
        )}
        {step === 6 && (
          <Button className="w-full" size="lg" onClick={goGenerate} disabled={generating}>
            {generating ? "Montando teu plano…" : "Gerar meu plano"}
          </Button>
        )}
        {step === 7 && (
          <Button className="w-full" size="lg" onClick={finish}>
            Ok, vamos conversar
          </Button>
        )}
        {step > 0 && step < 7 && (
          <Button variant="ghost" className="w-full" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
        )}
      </footer>
    </div>
  );
}
