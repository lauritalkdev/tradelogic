"use client";

import Link from "next/link";
import {
  FormEvent,
  Suspense,
  useMemo,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { signUp } from "@/src/services/auth";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const referralFromUrl = useMemo(() => {
    return (
      searchParams.get("ref")?.trim().toUpperCase() ||
      ""
    );
  }, [searchParams]);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [referralCode, setReferralCode] = useState(
    () => referralFromUrl
  );

  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanFullName = fullName.trim();
    const cleanUsername = username.trim();
    const cleanEmail = email.trim();

    if (
      !cleanFullName ||
      !cleanUsername ||
      !cleanEmail ||
      !password ||
      !confirmPassword
    ) {
      setErrorMessage(
        "Please complete all required fields."
      );
      return;
    }

    if (password.length < 8) {
      setErrorMessage(
        "Your password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "The passwords do not match."
      );
      return;
    }

    try {
      setIsLoading(true);

      const data = await signUp({
        fullName: cleanFullName,
        username: cleanUsername,
        email: cleanEmail,
        password,
        referralCode:
          referralCode.trim() || undefined,
      });

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setSuccessMessage(
        "Account created successfully. Check your email and click the confirmation link before signing in."
      );

      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Registration failed:", error);

      const message =
        error instanceof Error
          ? error.message.toLowerCase()
          : "";

      if (
        message.includes("already registered") ||
        message.includes("already exists")
      ) {
        setErrorMessage(
          "An account may already exist with this email address."
        );
      } else {
        setErrorMessage(
          "We could not create your TradeLogic account. Please check your information and try again."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#061A14] text-[#F7F7F2]">
      {/* Animated luxury market background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Brighter atmospheric lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_26%,rgba(34,139,34,0.22),transparent_35%),radial-gradient(circle_at_12%_24%,rgba(212,175,55,0.11),transparent_28%),radial-gradient(circle_at_88%_62%,rgba(30,136,229,0.08),transparent_32%),linear-gradient(145deg,#08251b_0%,#061712_44%,#071A2F_100%)]" />

        {/* Moving market grid */}
        <div className="market-grid absolute -inset-[120px] opacity-[0.13]" />

        {/* Moving chart layer */}
        <div className="chart-drift absolute inset-0">
          <svg
            viewBox="0 0 1600 1000"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id="goldChart"
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
                  offset="18%"
                  stopColor="#D4AF37"
                  stopOpacity="0.24"
                />
                <stop
                  offset="50%"
                  stopColor="#E7C75C"
                  stopOpacity="0.8"
                />
                <stop
                  offset="82%"
                  stopColor="#D4AF37"
                  stopOpacity="0.25"
                />
                <stop
                  offset="100%"
                  stopColor="#D4AF37"
                  stopOpacity="0"
                />
              </linearGradient>

              <linearGradient
                id="greenChart"
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop
                  offset="0%"
                  stopColor="#22C55E"
                  stopOpacity="0"
                />
                <stop
                  offset="45%"
                  stopColor="#22C55E"
                  stopOpacity="0.48"
                />
                <stop
                  offset="100%"
                  stopColor="#22C55E"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d="M0 770 C85 730 155 810 240 720 C330 625 380 680 455 590 C535 495 615 560 685 475 C755 390 850 460 930 365 C1015 265 1100 345 1185 250 C1270 160 1375 230 1600 115"
              fill="none"
              stroke="url(#goldChart)"
              strokeWidth="3"
            />

            <path
              d="M0 865 C115 815 180 890 290 805 C390 725 455 795 555 690 C655 580 720 660 820 550 C920 440 1010 530 1100 420 C1190 310 1310 390 1600 205"
              fill="none"
              stroke="url(#greenChart)"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* Left candlestick market */}
        <div className="candles-left absolute bottom-[12%] left-[4%] hidden h-[53%] w-[17%] items-end justify-around lg:flex">
          <div className="candle candle-1">
            <span className="wick h-24" />
            <span className="body h-14 bg-[#D4AF37]" />
          </div>

          <div className="candle candle-2">
            <span className="wick h-36" />
            <span className="body h-20 bg-[#22C55E]" />
          </div>

          <div className="candle candle-3">
            <span className="wick h-28" />
            <span className="body h-12 bg-[#D4AF37]" />
          </div>

          <div className="candle candle-4">
            <span className="wick h-44" />
            <span className="body h-24 bg-[#22C55E]" />
          </div>

          <div className="candle candle-5">
            <span className="wick h-32" />
            <span className="body h-16 bg-[#D4AF37]" />
          </div>
        </div>

        {/* Right candlestick market */}
        <div className="candles-right absolute bottom-[11%] right-[4%] hidden h-[58%] w-[17%] items-end justify-around lg:flex">
          <div className="candle candle-2">
            <span className="wick h-28" />
            <span className="body h-14 bg-[#22C55E]" />
          </div>

          <div className="candle candle-4">
            <span className="wick h-36" />
            <span className="body h-20 bg-[#D4AF37]" />
          </div>

          <div className="candle candle-1">
            <span className="wick h-44" />
            <span className="body h-28 bg-[#22C55E]" />
          </div>

          <div className="candle candle-5">
            <span className="wick h-52" />
            <span className="body h-32 bg-[#D4AF37]" />
          </div>

          <div className="candle candle-3">
            <span className="wick h-60" />
            <span className="body h-36 bg-[#22C55E]" />
          </div>
        </div>

        {/* Floating market labels */}
        <div className="market-float market-label absolute left-[5%] top-[32%] hidden lg:block">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            XAUUSD
          </p>
          <p className="mt-1 text-sm font-medium text-[#22C55E]/70">
            +0.38%
          </p>
        </div>

        <div className="market-float market-label-delay absolute right-[6%] top-[27%] hidden lg:block">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            GBPUSD
          </p>
          <p className="mt-1 text-sm font-medium text-[#22C55E]/70">
            +0.71%
          </p>
        </div>

        <div className="market-float market-label-slow absolute right-[8%] bottom-[29%] hidden lg:block">
          <p className="text-[10px] uppercase tracking-[0.22em] text-white/30">
            EURUSD
          </p>
          <p className="mt-1 text-sm font-medium text-[#22C55E]/70">
            +0.52%
          </p>
        </div>

        {/* Gold lighting */}
        <div className="pulse-light absolute left-1/2 top-[15%] h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-[#D4AF37]/[0.05] blur-[120px]" />

        <div className="absolute -left-32 bottom-[12%] h-96 w-96 rounded-full bg-[#228B22]/[0.09] blur-[120px]" />

        <div className="absolute -right-28 top-[22%] h-96 w-96 rounded-full bg-[#D4AF37]/[0.07] blur-[125px]" />

        {/* Edge vignette */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,13,10,0.12),transparent_20%,transparent_76%,rgba(2,10,8,0.7))]" />
      </div>

      {/* Header */}
      <header className="relative z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
          <Link
            href="/"
            className="group inline-flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D4AF37]/50 bg-[#0B3D2E]/85 text-lg font-bold text-[#D4AF37] shadow-[0_10px_35px_rgba(0,0,0,0.25)] backdrop-blur-xl transition group-hover:border-[#D4AF37]/80">
              G
            </div>

            <div>
              <p className="text-xl font-semibold tracking-tight">
                TradeLogic
              </p>

              <p className="text-[9px] uppercase tracking-[0.25em] text-[#D4AF37]/60">
                Automated Trading
              </p>
            </div>
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2.5 text-xs font-medium text-white/65 backdrop-blur-xl transition hover:border-[#D4AF37]/35 hover:text-[#D4AF37]"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Registration */}
      <section className="relative z-10 mx-auto flex w-full max-w-7xl justify-center px-5 pb-16 pt-5 sm:px-8 sm:pt-8">
        <div className="w-full max-w-[570px]">
          <div className="mb-5 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] px-4 py-2 backdrop-blur-xl">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.8)]" />

              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#E7C75C]/85">
                Create Your Trading Account
              </span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[32px] border border-[#D4AF37]/20 bg-[#071A2F]/75 shadow-[0_35px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
            <div className="absolute left-1/2 top-0 h-px w-4/5 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#E7C75C] to-transparent opacity-80" />

            <div className="absolute left-1/2 top-0 h-28 w-72 -translate-x-1/2 bg-[#D4AF37]/[0.04] blur-3xl" />

            <div className="p-6 sm:p-8">
              <div className="mb-7 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] border border-[#D4AF37]/40 bg-gradient-to-br from-[#0B3D2E] to-[#072B21] text-2xl font-bold text-[#D4AF37] shadow-[0_15px_40px_rgba(0,0,0,0.3)]">
                  G
                </div>

                <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                  Create your account
                </h1>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/45">
                  Join TradeLogic and prepare your account
                  for automated rule-based trading.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm leading-5 text-red-200">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="mb-6 rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/10 px-4 py-4 text-sm leading-6 text-green-200">
                  {successMessage}

                  <div className="mt-3">
                    <Link
                      href="/login"
                      className="font-semibold text-[#D4AF37] transition hover:text-[#E7C75C]"
                    >
                      Go to login
                    </Link>
                  </div>
                </div>
              )}

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="fullName"
                      className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
                    >
                      Full name
                    </label>

                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      autoComplete="name"
                      required
                      value={fullName}
                      onChange={(event) =>
                        setFullName(event.target.value)
                      }
                      placeholder="Your full name"
                      className="w-full rounded-xl border border-white/10 bg-[#04110D]/65 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#D4AF37]/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="username"
                      className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
                    >
                      Username
                    </label>

                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      required
                      value={username}
                      onChange={(event) =>
                        setUsername(event.target.value)
                      }
                      placeholder="Choose username"
                      className="w-full rounded-xl border border-white/10 bg-[#04110D]/65 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#D4AF37]/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]"
                    />
                  </div>
                </div>

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
                  <label
                    htmlFor="password"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      placeholder="Minimum 8 characters"
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

                  {password && (
                    <div className="mt-3 grid gap-2 text-[11px] text-white/35 sm:grid-cols-2">
                      <PasswordCheck
                        passed={passwordChecks.length}
                        label="At least 8 characters"
                      />

                      <PasswordCheck
                        passed={
                          passwordChecks.uppercase
                        }
                        label="One uppercase letter"
                      />

                      <PasswordCheck
                        passed={passwordChecks.number}
                        label="One number"
                      />

                      <PasswordCheck
                        passed={passwordChecks.special}
                        label="One special character"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
                  >
                    Confirm password
                  </label>

                  <div className="relative">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={
                        showConfirmPassword
                          ? "text"
                          : "password"
                      }
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(
                          event.target.value
                        )
                      }
                      placeholder="Enter password again"
                      className="w-full rounded-xl border border-white/10 bg-[#04110D]/65 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#D4AF37]/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          (current) => !current
                        )
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-white/35 transition hover:text-[#D4AF37]"
                    >
                      {showConfirmPassword
                        ? "Hide"
                        : "Show"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-4">
                    <label
                      htmlFor="referralCode"
                      className="block text-xs font-medium uppercase tracking-[0.08em] text-white/50"
                    >
                      Referral code
                    </label>

                    <span className="text-[10px] uppercase tracking-[0.14em] text-white/25">
                      Optional
                    </span>
                  </div>

                  <input
                    id="referralCode"
                    name="referralCode"
                    type="text"
                    value={referralCode}
                    onChange={(event) =>
                      setReferralCode(
                        event.target.value.toUpperCase()
                      )
                    }
                    placeholder="ERIC-XXXXXXXX"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-[#04110D]/65 px-4 py-3.5 font-mono text-sm uppercase text-white outline-none transition placeholder:text-white/20 hover:border-white/15 focus:border-[#D4AF37]/60 focus:shadow-[0_0_0_3px_rgba(212,175,55,0.06)]"
                  />

                  {referralFromUrl && (
                    <p className="mt-2 text-[11px] text-[#D4AF37]/65">
                      Referral code automatically applied
                      from your invitation link.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3">
                  <p className="text-[11px] leading-5 text-white/35">
                    By creating an account, you confirm
                    that the information provided is yours
                    and you agree to use TradeLogic
                    responsibly.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C75C] to-[#D4AF37] px-4 py-4 text-sm font-bold text-[#06120F] shadow-[0_15px_40px_rgba(212,175,55,0.16)] transition hover:brightness-110 hover:shadow-[0_18px_50px_rgba(212,175,55,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isLoading
                    ? "Creating your account..."
                    : "Create TradeLogic Account"}
                </button>
              </form>

              <div className="mt-7 border-t border-white/[0.08] pt-6 text-center">
                <p className="text-sm text-white/40">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-[#D4AF37] transition hover:text-[#E7C75C]"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>

            <div className="border-t border-white/[0.07] bg-[#04110D]/35 px-6 py-4">
              <div className="grid grid-cols-3 divide-x divide-white/[0.07] text-center">
                <div className="px-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">
                    Access
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-white/50">
                    Secure
                  </p>
                </div>

                <div className="px-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">
                    Platform
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-white/50">
                    Automated
                  </p>
                </div>

                <div className="px-2">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-white/25">
                    Dashboard
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-white/50">
                    Real-time
                  </p>
                </div>
              </div>
            </div>
          </div>

          <p className="mx-auto mt-6 max-w-md text-center text-[11px] leading-5 text-white/25">
            Your TradeLogic login password should never be
            shared with another person.
          </p>
        </div>
      </section>

      <style jsx global>{`
        @keyframes tradelogicGridMove {
          0% {
            transform: translate3d(0, 0, 0);
          }

          100% {
            transform: translate3d(64px, 64px, 0);
          }
        }

        @keyframes tradelogicChartDrift {
          0% {
            transform: translate3d(-2%, 1%, 0)
              scale(1.04);
          }

          50% {
            transform: translate3d(2%, -1%, 0)
              scale(1.07);
          }

          100% {
            transform: translate3d(-2%, 1%, 0)
              scale(1.04);
          }
        }

        @keyframes tradelogicCandleFloat {
          0%,
          100% {
            transform: translateY(8px);
          }

          50% {
            transform: translateY(-14px);
          }
        }

        @keyframes tradelogicMarketFloat {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.65;
          }

          50% {
            transform: translateY(-12px);
            opacity: 0.9;
          }
        }

        @keyframes tradelogicPulse {
          0%,
          100% {
            opacity: 0.45;
            transform: translateX(-50%) scale(1);
          }

          50% {
            opacity: 0.75;
            transform: translateX(-50%) scale(1.08);
          }
        }

        .market-grid {
          background-image:
            linear-gradient(
              rgba(212, 175, 55, 0.16) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(212, 175, 55, 0.16) 1px,
              transparent 1px
            );
          background-size: 64px 64px;
          animation: tradelogicGridMove 14s linear infinite;
        }

        .chart-drift {
          opacity: 0.22;
          animation: tradelogicChartDrift 12s ease-in-out
            infinite;
        }

        .candle {
          position: relative;
          display: flex;
          width: 12px;
          align-items: center;
          justify-content: center;
          opacity: 0.38;
          animation: tradelogicCandleFloat 4.5s
            ease-in-out infinite;
        }

        .candle .wick {
          position: absolute;
          bottom: 0;
          width: 2px;
          background: rgba(231, 199, 92, 0.7);
        }

        .candle .body {
          position: absolute;
          bottom: 25%;
          width: 8px;
          border-radius: 2px;
          box-shadow: 0 0 16px
            rgba(212, 175, 55, 0.15);
        }

        .candle-1 {
          animation-delay: 0s;
        }

        .candle-2 {
          animation-delay: -0.8s;
        }

        .candle-3 {
          animation-delay: -1.6s;
        }

        .candle-4 {
          animation-delay: -2.4s;
        }

        .candle-5 {
          animation-delay: -3.2s;
        }

        .market-float {
          animation: tradelogicMarketFloat 5s ease-in-out
            infinite;
        }

        .market-label-delay {
          animation-delay: -1.7s;
        }

        .market-label-slow {
          animation-delay: -3s;
        }

        .pulse-light {
          animation: tradelogicPulse 7s ease-in-out
            infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .market-grid,
          .chart-drift,
          .candle,
          .market-float,
          .pulse-light {
            animation: none !important;
          }
        }
      `}</style>
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
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] ${
          passed
            ? "border-[#22C55E]/40 bg-[#22C55E]/10 text-[#22C55E]"
            : "border-white/10 bg-white/[0.03] text-white/20"
        }`}
      >
        âœ“
      </span>

      <span
        className={
          passed
            ? "text-[#22C55E]/75"
            : "text-white/30"
        }
      >
        {label}
      </span>
    </div>
  );
}

function RegisterLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061A14] text-[#F7F7F2]">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#0B3D2E] text-xl font-bold text-[#D4AF37]">
          G
        </div>

        <p className="mt-4 text-sm text-white/40">
          Loading TradeLogic...
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterLoading />}>
      <RegisterForm />
    </Suspense>
  );
}
