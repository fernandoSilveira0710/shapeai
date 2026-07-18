"use client";

import { useEffect } from "react";
import { AuthBootstrap } from "@/components/auth-bootstrap";

export function Providers({ children }: { children: React.ReactNode }) {
  // mata service worker fantasma de versões antigas (segurava bundle/CSS velho
  // em cache infinito). Remover quando o PWA real (Serwist) entrar.
  useEffect(() => {
    navigator.serviceWorker
      ?.getRegistrations()
      .then((rs) => rs.forEach((r) => r.unregister()))
      .catch(() => {});
    if ("caches" in window) {
      caches
        .keys()
        .then((ks) => ks.forEach((k) => void caches.delete(k)))
        .catch(() => {});
    }
  }, []);

  return <AuthBootstrap>{children}</AuthBootstrap>;
}
