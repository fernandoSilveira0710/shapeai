/**
 * Mídia open-source (free-exercise-db via jsDelivr).
 * Imagens 0.jpg / 1.jpg — usamos as duas pra “loop” visual.
 * License: ver yuhonas/free-exercise-db
 */
const CDN =
  "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

function frames(folder: string) {
  return {
    primary: `${CDN}/${folder}/0.jpg`,
    secondary: `${CDN}/${folder}/1.jpg`,
  };
}

/** Map exercise id → media frames */
export const EXERCISE_MEDIA: Record<
  string,
  { primary: string; secondary?: string }
> = {
  "bench-press": frames("Barbell_Bench_Press_-_Medium_Grip"),
  "incline-dumbbell-press": frames("Incline_Dumbbell_Press"),
  "push-up": frames("Pushups"),
  "lat-pulldown": frames("Wide-Grip_Lat_Pulldown"),
  "barbell-row": frames("Bent_Over_Barbell_Row"),
  "dumbbell-row": frames("One-Arm_Dumbbell_Row"),
  "pull-up": frames("Pullups"),
  "overhead-press": frames("Standing_Military_Press"),
  "lateral-raise": frames("Side_Lateral_Raise"),
  squat: frames("Barbell_Full_Squat"),
  "goblet-squat": frames("Goblet_Squat"),
  "bodyweight-squat": frames("Bodyweight_Squat"),
  "romanian-deadlift": frames("Romanian_Deadlift"),
  "leg-press": frames("Leg_Press"),
  lunges: frames("Dumbbell_Lunges"),
  "leg-curl": frames("Lying_Leg_Curls"),
  "calf-raise": frames("Standing_Calf_Raises"),
  "barbell-curl": frames("Barbell_Curl"),
  "dumbbell-curl": frames("Dumbbell_Bicep_Curl"),
  "triceps-pushdown": frames("Triceps_Pushdown"),
  "overhead-triceps": frames("Seated_Triceps_Press"),
  plank: frames("Plank"),
  "hip-thrust": frames("Barbell_Hip_Thrust"),
  // dead-bug: sem pasta confiável no dataset — fallback emoji
};

export function getExerciseMedia(id: string) {
  return EXERCISE_MEDIA[id] ?? null;
}
