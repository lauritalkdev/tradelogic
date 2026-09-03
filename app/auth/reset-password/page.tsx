"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { updatePassword } from "@/src/services/auth";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();

    let mounted = true;

    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (session) {
        setHasRecoverySession(true);
      }

      setCheckingSession(false);
    }

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" && session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
        return;
      }

      if (session) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    }),
    [password]
  );

  const isPasswordValid =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number &&
    passwordChecks.special;

  const passwordsMatch =
    password.length > 0 &&
    confirmPassword.length > 0 &&
    password === confirmPassword;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");

    if (!hasRecoverySession) {
      setErrorMessage(
        "Your password recovery session is no longer valid. Please request a new reset link."
      );
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage(
        "Your password must contain at least 8 characters, including one uppercase letter, one lowercase letter, one number and one symbol."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      await updatePassword(password);

      const supabase = createClient();

      await supabase.auth.signOut();

      router.replace("/login?password_reset=success");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not update your password. Please request a new reset link and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04110D] px-4 py-10 text-[#F7F7F2] sm:px-6">
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(34,139,34,0.17),transparent_30%),radial-gradient(circle_at_22%_78%,rgba(212,175,55,0.09),transparent_30%),linear-gradient(145deg,#061a14_0%,#04110d_48%,#071A2F_100%)]" />

        <div
          className="absolute -inset-[120px] opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(212,175,55,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.15) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
          }}
        />

        <div className="absolute -right-40 top-10 h-[500px] w-[500px] rounded-full bg-[#228B22]/[0.08] blur-[130px]" />

        <div className="absolute -left-40 bottom-0 h-[460px] w-[460px] rounded-full bg-[#D4AF37]/[0.055] blur-[130px]" />

        <svg
          viewBox="0 0 1600 900"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-[0.13]"
        >
          <defs>
            <linearGradient
              id="recoveryGold"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor="#D4AF37"
                stopOpacity="0"
              />

              <stop
                offset="50%"
                stopColor="#E7C75C"
                stopOpacity="0.8"
              />

              <stop
                offset="100%"
                stopColor="#D4AF37"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <path
            d="M0 720 C120 680 190 760 290 650 C390 540 470 620 565 520 C670 410 760 490 855 380 C960 260 1060 350 1160 245 C1270 130 1390 210 1600 70"
            fill="none"
            stroke="url(#recoveryGold)"
            strokeWidth="2"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-5rem)] max-w-lg items-center justify-center">
        <section className="w-full rounded-[28px] border border-white/[0.09] bg-[#061711]/80 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8">
          {/* Branding */}
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/45 bg-[#0B3D2E] text-xl font-bold text-[#D4AF37] shadow-[0_15px_45px_rgba(0,0,0,0.35)]">
              G
            </div>

            <h1 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
              Create a new password
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/40">
              Protect your TradeLogic account with a strong,
              unique password.
            </p>
          </div>

          {checkingSession ? (
            <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-7 text-center">
              <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-[#D4AF37]" />

              <p className="mt-4 text-sm text-white/40">
                Verifying your recovery link...
              </p>
            </div>
          ) : !hasRecoverySession ? (
            <div className="mt-8">
              <div className="rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/[0.06] p-5">
                <p className="text-sm font-semibold text-red-200">
                  Recovery link unavailable
                </p>

                <p className="mt-2 text-xs leading-5 text-white/40">
                  This password recovery link is invalid,
                  expired, or has already been used. Request
                  a new password reset email to continue.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  router.replace("/forgot-password")
                }
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C75C] to-[#D4AF37] px-5 py-3.5 text-sm font-bold text-[#06120F] transition hover:brightness-110"
              >
                Request New Reset Link
              </button>

              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="mt-3 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-5 py-3.5 text-sm font-medium text-white/60 transition hover:bg-white/[0.05]"
              >
                Return to Login
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 space-y-5"
            >
              {errorMessage && (
                <div className="rounded-xl border border-[#EF4444]/25 bg-[#EF4444]/[0.07] px-4 py-3">
                  <p className="text-xs leading-5 text-red-200">
                    {errorMessage}
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-xs font-medium text-white/60"
                >
                  New password
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-white/[0.09] bg-[#03100C]/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#D4AF37]/55 focus:ring-2 focus:ring-[#D4AF37]/10"
                  placeholder="Create a strong password"
                />
              </div>

              {/* Password requirements */}
              <div className="rounded-2xl border border-white/[0.07] bg-[#03100C]/45 p-4">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.13em] text-white/30">
                  Password requirements
                </p>

                <div className="grid gap-2 sm:grid-cols-2">
                  <PasswordCheck
                    passed={passwordChecks.length}
                    label="At least 8 characters"
                  />

                  <PasswordCheck
                    passed={passwordChecks.uppercase}
                    label="One uppercase letter"
                  />

                  <PasswordCheck
                    passed={passwordChecks.lowercase}
                    label="One lowercase letter"
                  />

                  <PasswordCheck
                    passed={passwordChecks.number}
                    label="One number"
                  />

                  <PasswordCheck
                    passed={passwordChecks.special}
                    label="One symbol"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-xs font-medium text-white/60"
                >
                  Confirm new password
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                  className="w-full rounded-xl border border-white/[0.09] bg-[#03100C]/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#D4AF37]/55 focus:ring-2 focus:ring-[#D4AF37]/10"
                  placeholder="Repeat your new password"
                />

                {confirmPassword.length > 0 && (
                  <p
                    className={`mt-2 text-[11px] ${
                      passwordsMatch
                        ? "text-green-400"
                        : "text-red-300"
                    }`}
                  >
                    {passwordsMatch
                      ? "Passwords match."
                      : "Passwords do not match."}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  !isPasswordValid ||
                  !passwordsMatch
                }
                className="w-full rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C75C] to-[#D4AF37] px-5 py-3.5 text-sm font-bold text-[#06120F] shadow-[0_15px_40px_rgba(212,175,55,0.12)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Updating Password..."
                  : "Update Password"}
              </button>

              <p className="text-center text-[11px] leading-5 text-white/25">
                After your password is changed, you will be
                signed out and returned to the TradeLogic login
                page.
              </p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

function PasswordCheck({
  passed,
  label,
}: {
  passed: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px] ${
          passed
            ? "border-[#22C55E]/50 bg-[#22C55E]/15 text-[#22C55E]"
            : "border-white/10 bg-white/[0.025] text-white/20"
        }`}
      >
        {passed ? "âœ“" : "â€¢"}
      </span>

      <span
        className={`text-[10px] ${
          passed ? "text-green-300/80" : "text-white/30"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
