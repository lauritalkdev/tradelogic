"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { signIn } from "@/src/services/auth";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [isLoading, setIsLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const confirmed =
    searchParams.get("confirmed") === "true";

  const passwordReset =
    searchParams.get("password_reset") ===
    "success";

  const confirmationFailed =
    searchParams.get("error") ===
    "confirmation_failed";

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");

    if (!email.trim() || !password) {
      setErrorMessage(
        "Enter your email address and password."
      );
      return;
    }

    try {
      setIsLoading(true);

      const data = await signIn(email, password);

      if (!data.session) {
        setErrorMessage(
          "We could not start your session. Please try again."
        );
        setIsLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Login failed:", error);

      const message =
        error instanceof Error
          ? error.message.toLowerCase()
          : "";

      if (message.includes("email not confirmed")) {
        setErrorMessage(
          "Your email address has not been confirmed yet. Please check your inbox and confirm your TradeLogic account before signing in."
        );
      } else if (
        message.includes("invalid login credentials")
      ) {
        setErrorMessage(
          "The email address or password you entered is incorrect."
        );
      } else {
        setErrorMessage(
          "We could not sign you in. Please try again."
        );
      }

      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-[#04110D] text-[#F7F7F2]">
      {/* Luxury background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        {/* Deep navy atmosphere */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(11,61,46,0.38),transparent_38%),radial-gradient(circle_at_8%_10%,rgba(13,39,68,0.5),transparent_30%),radial-gradient(circle_at_92%_90%,rgba(7,26,47,0.55),transparent_32%)]" />

        {/* Fine financial grid */}
        <div
          className="absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(212,175,55,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,0.18) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />

        {/* Center illumination */}
        <div className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0B3D2E]/20 blur-[100px]" />

        {/* Restrained gold lighting */}
        <div className="absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#D4AF37]/[0.06] blur-[110px]" />

        <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-[#D4AF37]/[0.05] blur-[130px]" />

        {/* Abstract trading chart */}
        <svg
          viewBox="0 0 1440 900"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full opacity-[0.12]"
        >
          <defs>
            <linearGradient
              id="tradelogic-chart"
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
                offset="20%"
                stopColor="#D4AF37"
                stopOpacity="0.35"
              />
              <stop
                offset="55%"
                stopColor="#E7C75C"
                stopOpacity="0.9"
              />
              <stop
                offset="100%"
                stopColor="#D4AF37"
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          <path
            d="M0 660 C100 650 150 570 230 600 C315 635 350 490 430 530 C505 570 540 410 620 450 C690 485 730 380 805 405 C875 430 920 300 1000 345 C1070 385 1110 255 1190 285 C1265 315 1320 180 1440 205"
            fill="none"
            stroke="url(#tradelogic-chart)"
            strokeWidth="2"
          />

          <path
            d="M0 720 C130 700 190 760 300 680 C405 605 470 680 565 590 C660 505 725 565 820 485 C915 405 980 460 1070 370 C1165 275 1260 330 1440 225"
            fill="none"
            stroke="#228B22"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
        </svg>

        {/* Decorative candlesticks */}
        <div className="absolute left-[7%] top-[23%] hidden items-end gap-3 opacity-[0.13] lg:flex">
          <span className="h-16 w-[3px] bg-[#D4AF37]" />
          <span className="h-28 w-[3px] bg-[#228B22]" />
          <span className="h-20 w-[3px] bg-[#D4AF37]" />
          <span className="h-36 w-[3px] bg-[#228B22]" />
          <span className="h-24 w-[3px] bg-[#D4AF37]" />
        </div>

        <div className="absolute bottom-[17%] right-[8%] hidden items-end gap-3 opacity-[0.12] lg:flex">
          <span className="h-20 w-[3px] bg-[#228B22]" />
          <span className="h-32 w-[3px] bg-[#D4AF37]" />
          <span className="h-24 w-[3px] bg-[#228B22]" />
          <span className="h-40 w-[3px] bg-[#D4AF37]" />
          <span className="h-28 w-[3px] bg-[#228B22]" />
        </div>

        {/* Edge shading */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(4,17,13,0.25),transparent_25%,transparent_70%,rgba(4,17,13,0.7))]" />
      </div>

      {/* Top brand */}
      <div className="absolute left-0 right-0 top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#0B3D2E]/80 font-bold text-[#D4AF37] shadow-lg shadow-black/20 backdrop-blur-xl transition group-hover:border-[#D4AF37]/70">
              G
            </div>

            <div>
              <p className="text-lg font-semibold tracking-tight">
                TradeLogic
              </p>

              <p className="text-[10px] uppercase tracking-[0.24em] text-[#D4AF37]/55">
                Automated Trading
              </p>
            </div>
          </Link>

          <Link
            href="/register"
            className="hidden rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-medium text-white/60 backdrop-blur-xl transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37] sm:block"
          >
            Create account
          </Link>
        </div>
      </div>

      {/* Central login */}
      <div className="relative z-10 flex min-h-screen w-full items-center justify-center px-5 pb-12 pt-28 sm:px-6">
        <div className="w-full max-w-[440px]">
          {/* Small premium marker */}
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3.5 py-2 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.7)]" />

              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-[#D4AF37]/80">
                Secure Account Access
              </span>
            </div>
          </div>

          {/* Login card */}
          <div className="relative overflow-hidden rounded-[30px] border border-white/[0.11] bg-[#071A2F]/75 shadow-[0_30px_100px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
            {/* Gold top accent */}
            <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#D4AF37]/80 to-transparent" />

            <div className="p-6 sm:p-8">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-gradient-to-br from-[#0B3D2E] to-[#072B21] text-xl font-bold text-[#D4AF37] shadow-[0_10px_35px_rgba(0,0,0,0.3)]">
                  G
                </div>

                <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">
                  Welcome back
                </h1>

                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-white/40">
                  Sign in to access your TradeLogic
                  trading dashboard.
                </p>
              </div>

              {confirmed && (
                <div className="mb-5 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-3 text-sm leading-5 text-green-200">
                  Your email has been confirmed
                  successfully. You can now sign in.
                </div>
              )}

              {passwordReset && (
                <div className="mb-5 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-3 text-sm leading-5 text-green-200">
                  Your password has been changed
                  successfully. Sign in with your new
                  password.
                </div>
              )}

              {confirmationFailed && (
                <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-200">
                  We could not confirm your account. The
                  confirmation link may be invalid or
                  expired.
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-200">
                  {errorMessage}
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
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
                    className="w-full rounded-xl border border-white/10 bg-[#04110D]/65 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#D4AF37]/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-4">
                    <label
                      htmlFor="password"
                      className="block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
                    >
                      Password
                    </label>

                    <Link
                      href="/forgot-password"
                      className="text-xs font-medium text-[#D4AF37]/80 transition hover:text-[#E7C75C]"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(event) =>
                        setPassword(
                          event.target.value
                        )
                      }
                      placeholder="Enter your password"
                      className="w-full rounded-xl border border-white/10 bg-[#04110D]/65 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#D4AF37]/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (current) => !current
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-white/35 transition hover:text-[#D4AF37]"
                    >
                      {showPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full overflow-hidden rounded-xl bg-[#D4AF37] px-4 py-3.5 text-sm font-bold text-[#06120F] shadow-[0_12px_35px_rgba(212,175,55,0.13)] transition hover:bg-[#E7C75C] hover:shadow-[0_14px_40px_rgba(212,175,55,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading
                    ? "Signing in..."
                    : "Sign in to TradeLogic"}
                </button>
              </form>

              <div className="mt-7 border-t border-white/[0.08] pt-6 text-center">
                <p className="text-sm text-white/40">
                  New to TradeLogic?{" "}
                  <Link
                    href="/register"
                    className="font-semibold text-[#D4AF37] transition hover:text-[#E7C75C]"
                  >
                    Create your account
                  </Link>
                </p>
              </div>
            </div>

            {/* Bottom security strip */}
            <div className="border-t border-white/[0.07] bg-[#04110D]/35 px-6 py-4">
              <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-white/25">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M7 10V7a5 5 0 0110 0v3M6 10h12v10H6V10z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>

                Secure TradeLogic Access
              </div>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] leading-5 text-white/20">
            Never share your TradeLogic password or account
            credentials with another person.
          </p>
        </div>
      </div>
    </main>
  );
}

function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#04110D] text-[#F7F7F2]">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/35 bg-[#0B3D2E] text-lg font-bold text-[#D4AF37]">
          G
        </div>

        <p className="mt-4 text-sm text-white/40">
          Loading TradeLogic...
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginForm />
    </Suspense>
  );
}
