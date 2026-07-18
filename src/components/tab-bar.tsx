"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, LineChart, User, Lock } from "lucide-react";
import { cn, vibrate } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";

const tabs = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/evolution", label: "Evolução", icon: LineChart },
  { href: "/me", label: "Eu", icon: User },
];

export function TabBar() {
  const pathname = usePathname();
  const intakeCompleted = useAppStore((s) => s.profile?.intakeCompleted);
  const approvedAt = useAppStore((s) => s.plan?.approvedAt);
  // Evolução/Eu só liberam depois do dossiê fechado + plano aprovado —
  // antes disso não há dado nenhum pra mostrar, e confunde o fluxo.
  const locked = !intakeCompleted || !approvedAt;

  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-canvas/95 backdrop-blur-md px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
      <ul className="grid grid-cols-3 gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          const isLocked = locked && href !== "/chat";

          if (isLocked) {
            return (
              <li key={href}>
                <button
                  type="button"
                  onClick={() => vibrate(6)}
                  aria-disabled="true"
                  aria-label={`${label} — libera ao fechar o plano`}
                  className="w-full flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium text-muted/40"
                >
                  <span className="relative">
                    <Icon className="size-5" strokeWidth={2} />
                    <Lock className="absolute -right-1.5 -bottom-1 size-2.5" />
                  </span>
                  {label}
                </button>
              </li>
            );
          }

          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition",
                  active ? "text-brand" : "text-muted hover:text-ink"
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
