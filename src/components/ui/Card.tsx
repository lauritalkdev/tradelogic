import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: boolean;
}

export default function Card({
  children,
  glow = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-2xl
        border border-[var(--card-border)]
        bg-[var(--card-bg)]
        p-5
        shadow-[0_18px_60px_rgba(0,0,0,0.25)]
        backdrop-blur-xl
        ${glow ? "shadow-[0_0_35px_rgba(212,175,55,0.10)]" : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}