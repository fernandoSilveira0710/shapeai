"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { tabs, useTabLock } from "@/components/tab-bar";

/**
 * Navegação lateral do app do aluno em telas largas (lg+) — substitui a
 * TabBar de baixo. Mesmos 3 tabs, mesma lógica de lock, visual
 * consistente com a sidebar do painel B2B (tokens iguais, área
 * diferente do produto).
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const locked = useTabLock();
  const profile = useAppStore((s) => s.profile);
  const signOut = useAppStore((s) => s.signOut);

  return (
    <aside className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-border">
      <div className="p-5 border-b border-border">
        <div className="text-brand font-bold text-lg tracking-tight">
          SHAPE
        </div>
        {profile && (
          <div className="text-xs text-muted mt-1 truncate">
            {profile.displayName}
          </div>
        )}
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const isLocked = locked && href !== "/chat";

          if (isLocked) {
            return (
              <span
                key={href}
                aria-disabled="true"
                aria-label={`${label} — libera ao fechar o plano`}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted/40"
              >
                <span className="relative">
                  <Icon className="size-4" />
                  <Lock className="absolute -right-1 -bottom-1 size-2.5" />
                </span>
                {label}
              </span>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand/10 text-brand" : "text-ink hover:bg-surface"
              )}
            >
              <Icon className="size-4" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <button
          type="button"
          onClick={() => signOut().then(() => router.replace("/"))}
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted hover:text-danger hover:bg-danger/10 transition"
        >
          <LogOut className="size-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
