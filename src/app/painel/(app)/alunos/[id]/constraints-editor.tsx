"use client";

import { useState } from "react";
import { EXERCISES } from "@/data/exercises";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Scope = "treino" | "dieta" | "comportamento";

export type ConstraintRow = {
  scope: Scope;
  kcal_target: number | null;
  protein_target_g: number | null;
  banned_exercise_ids: string[] | null;
  banned_foods: string[] | null;
  fixed_training_days: number[] | null;
  tone_override: string | null;
  notes: string | null;
};

function emptyRow(scope: Scope): ConstraintRow {
  return {
    scope,
    kcal_target: null,
    protein_target_g: null,
    banned_exercise_ids: [],
    banned_foods: [],
    fixed_training_days: null,
    tone_override: null,
    notes: "",
  };
}

export function ConstraintsEditor({
  studentLinkId,
  allowedScopes,
  initial,
}: {
  studentLinkId: string;
  allowedScopes: Scope[];
  initial: ConstraintRow[];
}) {
  const [rows, setRows] = useState<Record<Scope, ConstraintRow>>(() => {
    const map = {} as Record<Scope, ConstraintRow>;
    for (const scope of ["treino", "dieta", "comportamento"] as Scope[]) {
      map[scope] = initial.find((r) => r.scope === scope) ?? emptyRow(scope);
    }
    return map;
  });
  const [savedAt, setSavedAt] = useState<Record<Scope, string | null>>({
    treino: null,
    dieta: null,
    comportamento: null,
  });
  const [saving, setSaving] = useState<Scope | null>(null);

  async function save(scope: Scope) {
    setSaving(scope);
    const supabase = createSupabaseBrowser();
    const row = rows[scope];
    const { error } = await supabase!.from("profile_constraints").upsert(
      {
        student_link_id: studentLinkId,
        scope,
        kcal_target: row.kcal_target,
        protein_target_g: row.protein_target_g,
        banned_exercise_ids: row.banned_exercise_ids,
        banned_foods: row.banned_foods,
        fixed_training_days: row.fixed_training_days,
        tone_override: row.tone_override,
        notes: row.notes,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "student_link_id,scope" }
    );
    setSaving(null);
    if (!error) {
      setSavedAt((s) => ({
        ...s,
        [scope]: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      }));
    }
  }

  function update(scope: Scope, patch: Partial<ConstraintRow>) {
    setRows((r) => ({ ...r, [scope]: { ...r[scope], ...patch } }));
  }

  return (
    <div className="space-y-6">
      {allowedScopes.includes("treino") && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold mb-3">Treino</h3>

          <label className="block text-xs text-muted mb-1.5">Dias fixos</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {WEEKDAY_LABELS.map((label, wd) => {
              const active = rows.treino.fixed_training_days?.includes(wd) ?? false;
              return (
                <button
                  key={wd}
                  type="button"
                  onClick={() => {
                    const cur = rows.treino.fixed_training_days ?? [];
                    const next = active ? cur.filter((d) => d !== wd) : [...cur, wd].sort();
                    update("treino", { fixed_training_days: next.length ? next : null });
                  }}
                  className={`size-9 rounded-lg text-xs font-medium border transition ${
                    active
                      ? "bg-brand text-brand-fg border-brand"
                      : "bg-canvas border-border text-muted"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <label className="block text-xs text-muted mb-1.5">
            Exercícios banidos
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {(rows.treino.banned_exercise_ids ?? []).map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-danger/15 text-danger text-xs px-2.5 py-1"
              >
                {EXERCISES.find((e) => e.id === id)?.namePt ?? id}
                <button
                  type="button"
                  onClick={() =>
                    update("treino", {
                      banned_exercise_ids: (rows.treino.banned_exercise_ids ?? []).filter(
                        (x) => x !== id
                      ),
                    })
                  }
                  aria-label="Remover"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <select
            className="w-full h-10 rounded-xl bg-canvas border border-border px-3 text-sm mb-4"
            value=""
            onChange={(e) => {
              if (!e.target.value) return;
              const cur = rows.treino.banned_exercise_ids ?? [];
              if (!cur.includes(e.target.value)) {
                update("treino", { banned_exercise_ids: [...cur, e.target.value] });
              }
              e.target.value = "";
            }}
          >
            <option value="">+ adicionar exercício banido</option>
            {EXERCISES.filter(
              (e) => !(rows.treino.banned_exercise_ids ?? []).includes(e.id)
            ).map((e) => (
              <option key={e.id} value={e.id}>
                {e.namePt}
              </option>
            ))}
          </select>

          <label className="block text-xs text-muted mb-1.5">
            Orientação ao Shape (texto livre)
          </label>
          <textarea
            className="w-full min-h-[70px] rounded-xl bg-canvas border border-border px-3 py-2 text-sm mb-3"
            value={rows.treino.notes ?? ""}
            onChange={(e) => update("treino", { notes: e.target.value })}
            onBlur={() => save("treino")}
            placeholder='Ex: "priorizar posterior de coxa, sem agachamento livre"'
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => save("treino")}
              className="text-xs text-brand hover:underline"
              disabled={saving === "treino"}
            >
              {saving === "treino" ? "Salvando…" : "Salvar"}
            </button>
            {savedAt.treino && (
              <span className="text-[11px] text-muted">salvo às {savedAt.treino}</span>
            )}
          </div>
        </section>
      )}

      {allowedScopes.includes("dieta") && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold mb-3">Dieta</h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs text-muted mb-1.5">Meta kcal</label>
              <input
                type="number"
                className="w-full h-10 rounded-xl bg-canvas border border-border px-3 text-sm"
                value={rows.dieta.kcal_target ?? ""}
                onChange={(e) =>
                  update("dieta", { kcal_target: e.target.value ? Number(e.target.value) : null })
                }
                onBlur={() => save("dieta")}
              />
              {(rows.dieta.kcal_target ?? 0) > 0 && rows.dieta.kcal_target! < 1200 && (
                <p className="text-[11px] text-warning mt-1">
                  Abaixo de 1200 kcal é agressivo — confirma que é intencional.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">Proteína (g)</label>
              <input
                type="number"
                className="w-full h-10 rounded-xl bg-canvas border border-border px-3 text-sm"
                value={rows.dieta.protein_target_g ?? ""}
                onChange={(e) =>
                  update("dieta", {
                    protein_target_g: e.target.value ? Number(e.target.value) : null,
                  })
                }
                onBlur={() => save("dieta")}
              />
            </div>
          </div>

          <label className="block text-xs text-muted mb-1.5">
            Alimentos banidos (separe por vírgula)
          </label>
          <input
            className="w-full h-10 rounded-xl bg-canvas border border-border px-3 text-sm mb-4"
            value={(rows.dieta.banned_foods ?? []).join(", ")}
            onChange={(e) =>
              update("dieta", {
                banned_foods: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            onBlur={() => save("dieta")}
            placeholder="leite, glúten"
          />

          <label className="block text-xs text-muted mb-1.5">
            Orientação ao Shape (texto livre)
          </label>
          <textarea
            className="w-full min-h-[70px] rounded-xl bg-canvas border border-border px-3 py-2 text-sm mb-3"
            value={rows.dieta.notes ?? ""}
            onChange={(e) => update("dieta", { notes: e.target.value })}
            onBlur={() => save("dieta")}
            placeholder='Ex: "dieta barata, low carb nos dias de descanso"'
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => save("dieta")}
              className="text-xs text-brand hover:underline"
              disabled={saving === "dieta"}
            >
              {saving === "dieta" ? "Salvando…" : "Salvar"}
            </button>
            {savedAt.dieta && (
              <span className="text-[11px] text-muted">salvo às {savedAt.dieta}</span>
            )}
          </div>
        </section>
      )}

      {allowedScopes.includes("comportamento") && (
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h3 className="font-semibold mb-3">Comportamento</h3>

          <label className="block text-xs text-muted mb-1.5">Tom forçado (opcional)</label>
          <select
            className="w-full h-10 rounded-xl bg-canvas border border-border px-3 text-sm mb-4"
            value={rows.comportamento.tone_override ?? ""}
            onChange={(e) => update("comportamento", { tone_override: e.target.value || null })}
            onBlur={() => save("comportamento")}
          >
            <option value="">Sem override — usa o tom que o aluno escolheu</option>
            <option value="sargento">Sargento (aperta cobrança)</option>
            <option value="brother">Brother</option>
            <option value="nutella">Nutella</option>
            <option value="low_profile">Low profile</option>
          </select>

          <label className="block text-xs text-muted mb-1.5">
            Orientação ao Shape (texto livre)
          </label>
          <textarea
            className="w-full min-h-[70px] rounded-xl bg-canvas border border-border px-3 py-2 text-sm mb-3"
            value={rows.comportamento.notes ?? ""}
            onChange={(e) => update("comportamento", { notes: e.target.value })}
            onBlur={() => save("comportamento")}
            placeholder='Ex: "se faltar 2x seguidas, aperta o tom"'
          />

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => save("comportamento")}
              className="text-xs text-brand hover:underline"
              disabled={saving === "comportamento"}
            >
              {saving === "comportamento" ? "Salvando…" : "Salvar"}
            </button>
            {savedAt.comportamento && (
              <span className="text-[11px] text-muted">salvo às {savedAt.comportamento}</span>
            )}
          </div>
        </section>
      )}

      <p className="text-xs text-muted">
        Sem botão "Publicar" — cada seção salva sozinha e vale a partir da
        próxima mensagem do aluno no chat.
      </p>
    </div>
  );
}
