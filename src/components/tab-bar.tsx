"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, LineChart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/evolution", label: "Evolução", icon: LineChart },
  { href: "/me", label: "Eu", icon: User },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="sticky bottom-0 z-20 border-t border-border bg-canvas/95 backdrop-blur-md px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
      <ul className="grid grid-cols-3 gap-1">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
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
