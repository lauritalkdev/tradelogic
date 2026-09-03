"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { requestPasswordReset } from "@/src/services/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setErrorMessage("Enter your email address.");
      return;
    }

    try {
      setIsLoading(true);

      await requestPasswordReset(normalizedEmail);

      setSuccessMessage(
        "If an account exists for this email, a password reset link has been sent. Check your inbox and follow the instructions."
      );
    } catch (error) {
      console.error("Password reset request failed:", error);

      setErrorMessage(
        "We could not process your password reset request. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#06120F] px-5 py-12 text-[#F7F7F2]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#0B3D2E] text-lg font-bold text-[#D4AF37]">
              G
            </div>

            <span className="text-2xl font-semibold">
              TradeLogic
            </span>
          </Link>

          <h1 className="mt-8 text-3xl font-semibold tracking-tight">
            Forgot your password?
          </h1>

          <p className="mt-3 text-sm leading-6 text-white/45">
            Enter the email address connected to your
            TradeLogic account and we&apos;ll send you a secure
            password reset link.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#071A2F]/70 p-6 shadow-2xl shadow-black/20 sm:p-8">
          {errorMessage && (
            <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-200">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm leading-5 text-green-200">
              {successMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-white/70"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-[#06120F]/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#D4AF37]/60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#D4AF37] px-4 py-3.5 text-sm font-semibold text-[#06120F] transition hover:bg-[#E7C75C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading
                ? "Sending reset link..."
                : "Send reset link"}
            </button>
          </form>

          <div className="mt-6 border-t border-white/10 pt-6 text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-[#D4AF37] transition hover:text-[#E7C75C]"
            >
              Back to login
            </Link>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-white/25">
          TradeLogic will never ask you to send your account
          password by email.
        </p>
      </div>
    </main>
  );
}
