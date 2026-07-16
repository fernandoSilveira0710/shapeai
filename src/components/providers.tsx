"use client";

import { useEffect, useState } from "react";

/** Avoids hydration mismatch with zustand persist */
export function Providers({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) {
    return (
      <div className="app-shell items-center justify-center">
        <div className="text-brand font-bold text-2xl tracking-tight">Shape.ai</div>
        <p className="text-muted text-sm mt-2">Carregando teu personal…</p>
      </div>
    );
  }
  return <>{children}</>;
}
