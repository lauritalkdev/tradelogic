import type { ReactNode } from "react";

type StatusVariant =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral";

interface StatusBadgeProps {
  children: ReactNode;
  variant?: StatusVariant;
}

export default function StatusBadge({
  children,
  variant = "neutral",
}: StatusBadgeProps) {
  const variants: Record<StatusVariant, string> = {
    success:
      "border-green-500/20 bg-green-500/10 text-green-400",
    danger:
      "border-red-500/20 bg-red-500/10 text-red-400",
    warning:
      "border-[var(--color-gold)]/20 bg-[var(--color-gold)]/10 text-[var(--color-gold-light)]",
    info:
      "border-blue-500/20 bg-blue-500/10 text-blue-300",
    neutral:
      "border-white/10 bg-white/5 text-[var(--color-beige)]",
  };

  return (
    <span
      className={`
        inline-flex items-center
        rounded-full
        border
        px-3 py-1
        text-xs
        font-semibold
        tracking-wide
        ${variants[variant]}
      `}
    >
      {children}
    </span>
  );
}