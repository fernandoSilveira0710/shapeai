"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowser } from "@/lib/supabase/browser";

export function PainelSignOut() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="w-full text-left rounded-xl px-3 py-2.5 text-sm text-muted hover:text-danger hover:bg-danger/10 transition"
      onClick={async () => {
        const supabase = createSupabaseBrowser();
        await supabase?.auth.signOut();
        router.replace("/painel/signup");
      }}
    >
      Sair
    </button>
  );
}
