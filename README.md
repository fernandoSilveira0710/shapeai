# Shape.ai — Web App (MVP)

Personal de bolso: chat vivo + modo treino + nutri + evolução.

## Rodar agora

```bash
cd web
pnpm install
pnpm dev
```

Abre [http://localhost:3000](http://localhost:3000).

### O que funciona (localStorage + APIs opcionais)

1. **Onboarding** conversacional (objetivo, rotina, tom, plano)
2. **Redesign** do plano (“sou pobre…”, “sem agachamento…”)
3. **Chat** com abertura contextual + 4 tons + typing + typewriter
4. **Modo treino** com **mídia de exercício** (free-exercise-db), séries, descanso, wake lock
5. **Foto do prato** (Pro) → `/api/vision/meal` se tiver key
6. **Refeições** e **peso**
7. **Evolução** (streak, gráficos, insights)
8. Gate **Free / Básico / Pro** (demo no perfil)
9. **PWA** (manifest + ícones) — “Adicionar à tela inicial”
10. **Login Google** (quando Supabase configurado)

### LLM + Vision (opcional)

```bash
cp .env.example .env.local
# preencha OPENAI_API_KEY (ou DeepSeek via OPENAI_BASE_URL)
```

Sem key: coach **rule-based** (já usável). Vision cai em fallback.

### Supabase

1. Cria projeto Supabase  
2. Roda `../supabase/migrations/001_init.sql`  
3. Auth → Google provider + redirect `http://localhost:3000/auth/callback`  
4. Preenche `NEXT_PUBLIC_SUPABASE_*` em `.env.local`  
5. `/login` → Continuar com Google  

## Stack

- Next.js 16 + React 19 + Tailwind 4  
- Zustand (estado local MVP)  
- Vercel AI SDK (chat + vision opcional)  
- free-exercise-db (mídia)  
- Supabase (schema + OAuth callback)

## Specs do produto

Ver pasta pai: `../README.md` e `../00-produto` …
