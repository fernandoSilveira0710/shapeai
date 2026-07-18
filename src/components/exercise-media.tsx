"use client";

import { useEffect, useState } from "react";
import { getExerciseMedia } from "@/data/exercise-media";
import { cn } from "@/lib/utils";

export function ExerciseMedia({
  exerciseId,
  emoji,
  muscle,
  className,
}: {
  exerciseId: string;
  emoji: string;
  muscle?: string;
  className?: string;
}) {
  const media = getExerciseMedia(exerciseId);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [exerciseId]);

  const src = media && !failed ? media.gifUrl : null;

  return (
    <div
      className={cn(
        "relative rounded-3xl bg-elevated border border-border aspect-square max-h-[280px] mx-auto w-full overflow-hidden flex flex-col items-center justify-center",
        className
      )}
    >
      {src ? (
        // fundo branco = fundo dos GIFs do dataset; contain não corta o boneco
        <div className="absolute inset-0 bg-white flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={exerciseId}
            src={src}
            alt=""
            className="size-full object-contain animate-fade-in"
            onError={() => setFailed(true)}
            draggable={false}
          />
        </div>
      ) : (
        <>
          <span className="text-7xl">{emoji}</span>
          {muscle && (
            <span className="text-xs text-muted uppercase tracking-wider mt-2">
              {muscle}
            </span>
          )}
        </>
      )}
      {src && muscle && (
        <span className="absolute bottom-3 left-3 rounded-full bg-canvas/80 border border-border px-2.5 py-1 text-[11px] text-muted uppercase tracking-wider backdrop-blur-sm">
          {muscle}
        </span>
      )}
    </div>
  );
}