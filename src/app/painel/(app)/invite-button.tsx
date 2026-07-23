"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function InviteButton() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setCopied(false);
    const res = await fetch("/api/org/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_uses: 1 }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) setUrl(data.url);
  }

  return (
    <div>
      {!url ? (
        <Button onClick={generate} disabled={loading}>
          {loading ? "Gerando…" : "Gerar link de convite"}
        </Button>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <code className="text-sm text-brand truncate flex-1">{url}</code>
          <button
            type="button"
            className="text-xs text-muted hover:text-ink shrink-0"
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copiado ✓" : "Copiar"}
          </button>
          <button
            type="button"
            className="text-xs text-muted hover:text-ink shrink-0"
            onClick={() => setUrl(null)}
          >
            Novo
          </button>
        </div>
      )}
    </div>
  );
}
