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
  const [frame, setFrame] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFrame(0);
    setFailed(false);
  }, [exerciseId]);

  // alterna 0/1.jpg ~1.1s = sensação de GIF leve
  useEffect(() => {
    if (!media?.secondary || failed) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => setFrame((f) => (f === 0 ? 1 : 0)), 1100);
    return () => clearInterval(t);
  }, [media, failed, exerciseId]);

  const src =
    media && !failed
      ? frame === 1 && media.secondary
        ? media.secondary
        : media.primary
      : null;

  return (
    <div
      className={cn(
        "relative rounded-3xl bg-elevated border border-border aspect-square max-h-[280px] mx-auto w-full overflow-hidden flex flex-col items-center justify-center",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`${exerciseId}-${frame}`}
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover object-center animate-fade-in"
          onError={() => setFailed(true)}
          draggable={false}
        />
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
