"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50";

  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]",
    secondary:
      "border border-[var(--card-border)] bg-[var(--color-forest)] text-[var(--color-offwhite)] hover:bg-[var(--color-forest-dark)]",
    ghost:
      "border border-[var(--card-border)] bg-transparent text-[var(--color-beige)] hover:bg-white/5",
    danger:
      "bg-[var(--color-danger)] text-white hover:opacity-90",
  };

  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${
        fullWidth ? "w-full" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}