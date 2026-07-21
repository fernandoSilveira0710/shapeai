export type Tone = "brother" | "sargento" | "nutella" | "low_profile";

export type Goal =
  | "hipertrofia"
  | "emagrecimento"
  | "definicao"
  | "condicionamento"
  | "manutencao";

export type SubscriptionPlan = "free" | "basic" | "pro";

export type ExperienceLevel = "iniciante" | "intermediario" | "avancado";

export type Equipment =
  | "academia"
  | "casa"
  | "halteres"
  | "peso_corporal"
  | "parque";

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  weightKg: number;
  heightCm: number;
  age: number;
  goal: Goal;
  experience: ExperienceLevel;
  equipment: Equipment[];
  injuries: string;
  workType: string;
  budgetFood: "apertado" | "ok" | "folgado";
  dietRestrictions: string[];
  cooksAtHome: boolean;
  trainDays: number[]; // 0=dom .. 6=sab
  trainDurationMin: number;
  tone: Tone;
  onboardingCompleted: boolean;
  createdAt: string;
  /**
   * Primeiro contato conversacional (dossiê).
   * Enquanto false, o chat aprofunda perfil em vez de só "bora treinar".
   */
  intakeCompleted?: boolean;
  /** Respostas do intake — métrica pro personal / IA */
  intakeNotes?: {
    key: string;
    question: string;
    answer: string;
    at: string;
    metricLabel?: string;
  }[];
  /** horário combinado de treino (ex.: "06:00") — vem da entrevista */
  trainTime?: string;
  /** quer ser lembrado/cobrado (notificação) */
  wantsReminders?: boolean;
}

export interface Exercise {
  id: string;
  namePt: string;
  muscleGroup: string;
  equipment: string;
  instructionsShort: string;
  defaultRestSec: number;
  /** emoji fallback when no GIF */
  emoji: string;
  gifUrl?: string;
}

export interface PlanExercise {
  exerciseId: string;
  sets: number;
  reps: string;
  restSec: number;
  suggestedWeightKg?: number;
  notes?: string;
}

export interface PlanDay {
  weekday: number; // 0-6
  label: string;
  durationMin: number;
  exercises: PlanExercise[];
  isRest?: boolean;
}

export interface MealExample {
  slot: string;
  title: string;
  items: string[];
  swaps?: string[];
}

export interface NutritionPlan {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meals: MealExample[];
  groceryList: string[];
  notes: string;
}

/**
 * Trilha de mudanças do plano — forward-compatible com o painel do
 * personal (fase 3): quando o painel existir, ele lê isso direto.
 * Hoje é só log local (sincroniza via Supabase snapshot junto do resto).
 */
export interface PlanChangeLogEntry {
  at: string;
  /** o que o usuário pediu, em 1 linha */
  trigger: string;
  /** o que de fato mudou no plano */
  summary: string;
  tool:
    | "swap_food"
    | "swap_exercise"
    | "swap_workout_day"
    | "add_exercise"
    | "remove_exercise"
    | "redesign_plan";
}

export interface Plan {
  id: string;
  version: number;
  workoutDays: PlanDay[];
  nutrition: NutritionPlan;
  createdAt: string;
  source: "ai" | "user" | "coach";
  /** usuário bateu o martelo nessa versão */
  approvedAt?: string;
  changeLog?: PlanChangeLogEntry[];
}

export type MessageRole = "user" | "assistant" | "system";

export type RichCardType =
  | "workout"
  | "meal_check"
  | "insight"
  | "plan_summary"
  | "paywall"
  | "week_plan"
  | "diet_plan"
  | "tech_read"
  | "approve_plan";

export interface RichCard {
  type: RichCardType;
  title: string;
  body?: string;
  cta?: string;
  meta?: Record<string, string | number | boolean>;
  /** payload estruturado dos cards visuais (week_plan/diet_plan/tech_read) */
  payload?: unknown;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  rich?: RichCard;
  /** data URL comprimida (foto de refeição) */
  imageDataUrl?: string;
}

export interface WorkoutSetLog {
  exerciseId: string;
  setIndex: number;
  reps: number;
  weightKg: number;
  status: "completed" | "skipped";
  completedAt: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  label: string;
  status: "in_progress" | "completed" | "partial" | "abandoned";
  startedAt: string;
  endedAt?: string;
  sets: WorkoutSetLog[];
  skippedExercises: string[];
  planDayWeekday: number;
  /** resposta do "e aí, deu bom?" pós-treino */
  feedback?: string;
  feedbackAt?: string;
  /** anotações feitas durante o treino (descanso): dor, sensação, etc. */
  notes?: { text: string; at: string }[];
}

export interface MealLog {
  id: string;
  slot: string;
  description: string;
  adherence: "on_plan" | "partial" | "off";
  loggedAt: string;
  source: "text" | "chip" | "photo";
}

export type BodyMetricKind = "weight" | "waist" | "chest" | "arm" | "thigh";

export interface BodyMetric {
  id: string;
  kind: BodyMetricKind;
  value: number;
  measuredAt: string;
}

export interface AppState {
  profile: UserProfile | null;
  plan: Plan | null;
  messages: ChatMessage[];
  sessions: WorkoutSession[];
  mealLogs: MealLog[];
  metrics: BodyMetric[];
  subscription: SubscriptionPlan;
  activeWorkoutId: string | null;
  lastOpenDate: string | null;
  /** IA "digitando" / streaming — não persiste */
  typing: boolean;
  /** msg id da bolha em streaming */
  streamingId: string | null;
  /** contagem Free de chamadas LLM no dia */
  dailyLlmCount: number;
  dailyLlmDate: string | null;
  /** user id Supabase se logado */
  authUserId: string | null;
  /** fila de keys do intake + índice atual */
  intakeQueue: string[];
  intakeIndex: number;
  /** sessão aguardando feedback pós-treino ("e aí, deu bom?") */
  awaitingFeedbackId: string | null;
}
