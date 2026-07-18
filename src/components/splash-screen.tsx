"use client";

import { cn } from "@/lib/utils";

export function SplashScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "app-shell items-center justify-center gap-3 select-none",
        className
      )}
    >
      <div className="text-center animate-rise">
        <div className="text-brand font-bold text-3xl tracking-tight">SHAPE</div>
        <p className="text-muted text-sm mt-2">teu personal no bolso</p>
      </div>
      <div className="flex gap-1.5 mt-6" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-brand animate-pulse-soft"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
