import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, InputHTMLAttributes, TextareaHTMLAttributes } from "react";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "lg" && "h-14 px-5 text-base",
        variant === "primary" && "bg-brand text-brand-fg hover:brightness-110",
        variant === "secondary" &&
          "bg-elevated text-ink border border-border hover:bg-surface",
        variant === "ghost" && "bg-transparent text-muted hover:text-ink hover:bg-surface",
        variant === "danger" && "bg-danger/15 text-danger border border-danger/30",
        className
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full h-11 rounded-xl bg-surface border border-border px-3 text-ink placeholder:text-muted/70 outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl bg-surface border border-border px-3 py-2 text-ink placeholder:text-muted/70 outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20 min-h-[88px]",
        className
      )}
      {...props}
    />
  );
}

export function Chip({
  active,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-full px-3.5 py-2 text-sm border transition",
        active
          ? "bg-brand text-brand-fg border-brand font-semibold"
          : "bg-surface text-ink border-border hover:border-brand/40",
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-surface border border-border p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm text-muted mb-1.5">{children}</label>;
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
      <div
        className="h-full bg-brand transition-all duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Três pontinhos pulsando — IA "digitando" */
export function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" role="status" aria-label="Digitando">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 rounded-full bg-muted animate-bounce motion-reduce:animate-none"
          style={{ animationDelay: `${i * 140}ms`, animationDuration: "900ms" }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

/** Bottom sheet simples (mobile-first) */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div className="relative w-full max-w-[480px] rounded-t-3xl bg-elevated border-t border-x border-border p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-slide-up">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        {title && <h2 className="text-lg font-bold mb-3">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
