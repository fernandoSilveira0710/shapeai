/**
 * Mídia de exercícios — GIFs animados do exercises-dataset (hasaneyldrm/exercises-dataset).
 * 1.324 exercícios com GIF 180×180 + thumbnail + metadata em 10 idiomas.
 * Media © Gym visual — https://gymvisual.com/ (atribuição obrigatória).
 *
 * CDN: jsDelivr apontando pro repo original (cache global, grátis).
 */
const CDN =
  "https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@main";

/** Map exercise ID (Shape) → dataset GIF path */
export const EXERCISE_MEDIA: Record<string, { gif: string; thumb: string }> = {
  "bench-press":             { gif: "videos/0025-EIeI8Vf.gif",  thumb: "images/0025-EIeI8Vf.jpg"  },
  "incline-dumbbell-press":  { gif: "videos/0314-ns0SIbU.gif",  thumb: "images/0314-ns0SIbU.jpg"  },
  "push-up":                 { gif: "videos/0662-I4hDWkc.gif",  thumb: "images/0662-I4hDWkc.jpg"  },
  "lat-pulldown":            { gif: "videos/2330-LEprlgG.gif",  thumb: "images/2330-LEprlgG.jpg"  },
  "barbell-row":             { gif: "videos/0027-eZyBC3j.gif",  thumb: "images/0027-eZyBC3j.jpg"  },
  "dumbbell-row":            { gif: "videos/0292-C0MA9bC.gif",  thumb: "images/0292-C0MA9bC.jpg"  },
  "pull-up":                 { gif: "videos/0652-lBDjFxJ.gif",  thumb: "images/0652-lBDjFxJ.jpg"  },
  "overhead-press":          { gif: "videos/1456-wdRZISl.gif",  thumb: "images/1456-wdRZISl.jpg"  },
  "lateral-raise":           { gif: "videos/0334-DsgkuIt.gif",  thumb: "images/0334-DsgkuIt.jpg"  },
  "squat":                   { gif: "videos/0043-qXTaZnJ.gif",  thumb: "images/0043-qXTaZnJ.jpg"  },
  "goblet-squat":            { gif: "videos/1760-yn8yg1r.gif",  thumb: "images/1760-yn8yg1r.jpg"  },
  "bodyweight-squat":        { gif: "videos/2368-9E25EOx.gif",  thumb: "images/2368-9E25EOx.jpg"  },
  "romanian-deadlift":       { gif: "videos/0085-wQ2c4XD.gif",  thumb: "images/0085-wQ2c4XD.jpg"  },
  "leg-press":               { gif: "videos/2287-V07qpXy.gif",  thumb: "images/2287-V07qpXy.jpg"  },
  "lunges":                  { gif: "videos/0336-RRWFUcw.gif",  thumb: "images/0336-RRWFUcw.jpg"  },
  "leg-curl":                { gif: "videos/0586-17lJ1kr.gif",  thumb: "images/0586-17lJ1kr.jpg"  },
  "calf-raise":              { gif: "videos/1373-bJYHBIN.gif",  thumb: "images/1373-bJYHBIN.jpg"  },
  "barbell-curl":            { gif: "videos/0031-25GPyDY.gif",  thumb: "images/0031-25GPyDY.jpg"  },
  "dumbbell-curl":           { gif: "videos/0294-NbVPDMW.gif",  thumb: "images/0294-NbVPDMW.jpg"  },
  "triceps-pushdown":        { gif: "videos/0201-3ZflifB.gif",  thumb: "images/0201-3ZflifB.jpg"  },
  "overhead-triceps":        { gif: "videos/2188-kont8Ut.gif",  thumb: "images/2188-kont8Ut.jpg"  },
  "plank":                   { gif: "videos/0464-CosupLu.gif",  thumb: "images/0464-CosupLu.jpg"  },
  "dead-bug":                { gif: "videos/0276-iny3m5y.gif",  thumb: "images/0276-iny3m5y.jpg"  },
  "hip-thrust":              { gif: "videos/1409-qKBpF7I.gif",  thumb: "images/1409-qKBpF7I.jpg"  },
};

export function getExerciseMedia(id: string): { gifUrl: string; thumbUrl: string } | null {
  const entry = EXERCISE_MEDIA[id];
  if (!entry) return null;
  return {
    gifUrl: `${CDN}/${entry.gif}`,
    thumbUrl: `${CDN}/${entry.thumb}`,
  };
}