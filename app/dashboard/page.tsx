import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import ProfileMenu from "@/src/components/dashboard/ProfileMenu";
import TradingControl from "@/src/components/dashboard/TradingControl";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, username, referral_code, account_status"
    )
    .eq("id", user.id)
    .maybeSingle();

  const displayName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    user.email?.split("@")[0] ||
    "Trader";

  const accountStatus =
    profile?.account_status ?? "active";

  const firstInitial =
    displayName.charAt(0).toUpperCase();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04110D] text-[#F7F7F2]">
      {/* ===================================================== */}
      {/* PREMIUM ANIMATED BACKGROUND */}
      {/* ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_12%,rgba(34,139,34,0.16),transparent_34%),radial-gradient(circle_at_18%_78%,rgba(212,175,55,0.08),transparent_30%),linear-gradient(145deg,#061a14_0%,#04110d_45%,#071A2F_100%)]" />

        <div className="dashboard-market-grid absolute -inset-[140px] opacity-[0.08]" />

        <div className="dashboard-chart absolute inset-0 opacity-[0.16]">
          <svg
            viewBox="0 0 1800 1000"
            preserveAspectRatio="none"
            className="h-full w-full"
          >
            <defs>
              <linearGradient
                id="dashboardGold"
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
                  offset="25%"
                  stopColor="#D4AF37"
                  stopOpacity="0.2"
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

              <linearGradient
                id="dashboardGreen"
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
                  offset="50%"
                  stopColor="#22C55E"
                  stopOpacity="0.55"
                />

                <stop
                  offset="100%"
                  stopColor="#22C55E"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>

            <path
              d="M0 760 C120 715 180 795 285 700 C390 610 455 685 560 580 C670 470 735 560 845 450 C950 345 1030 430 1140 315 C1240 210 1350 300 1450 205 C1540 125 1650 175 1800 80"
              fill="none"
              stroke="url(#dashboardGold)"
              strokeWidth="3"
            />

            <path
              d="M0 850 C135 810 230 875 335 790 C440 705 520 770 620 665 C735 545 820 625 925 530 C1030 435 1125 505 1225 395 C1330 285 1460 370 1560 255 C1640 165 1710 185 1800 120"
              fill="none"
              stroke="url(#dashboardGreen)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="absolute -right-40 top-12 h-[500px] w-[500px] rounded-full bg-[#D4AF37]/[0.045] blur-[130px]" />

        <div className="absolute -left-44 bottom-0 h-[520px] w-[520px] rounded-full bg-[#228B22]/[0.07] blur-[140px]" />
      </div>

      {/* ===================================================== */}
      {/* SIDEBAR */}
      {/* ===================================================== */}

      <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[245px] border-r border-white/[0.08] bg-[#03100C]/85 backdrop-blur-2xl xl:flex xl:flex-col">
        <div className="border-b border-white/[0.08] px-6 py-7">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/45 bg-[#0B3D2E] text-xl font-bold text-[#D4AF37] shadow-[0_10px_35px_rgba(0,0,0,0.35)]">
              G
            </div>

            <div>
              <p className="text-xl font-semibold tracking-tight">
                TradeLogic
              </p>

              <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-[#D4AF37]/55">
                Automated Trading
              </p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1.5 px-4 py-6">
          <SidebarItem
            href="/dashboard"
            label="Dashboard"
            icon="âŒ‚"
            active
          />

          <SidebarItem
            href="#"
            label="Subscription"
            icon="$"
          />

          <SidebarItem
            href="#"
            label="MT5 Account"
            icon="MT"
          />

          <SidebarItem
            href="#"
            label="Trading Activity"
            icon="â†—"
          />

          <SidebarItem
            href="#"
            label="Performance"
            icon="%"
          />

          <SidebarItem
            href="#"
            label="Referrals"
            icon="R"
          />

          <SidebarItem
            href="#"
            label="Settings"
            icon="âš™"
          />
        </nav>

        <div className="border-t border-white/[0.08] p-4">
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-4">
            <p className="text-xs font-semibold text-[#E7C75C]">
              TradeLogic Account
            </p>

            <p className="mt-2 text-[11px] leading-5 text-white/35">
              Activate a subscription and connect MT5
              before automated trading can begin.
            </p>
          </div>

          <p className="mt-6 px-2 text-[10px] leading-5 text-white/20">
            TradeLogic automated trading platform
          </p>
        </div>
      </aside>

      {/* ===================================================== */}
      {/* MAIN AREA */}
      {/* ===================================================== */}

      <div className="relative z-10 xl:pl-[245px]">
        {/* Header */}

        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#04110D]/75 backdrop-blur-2xl">
          <div className="flex min-h-[76px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-9">
            <div className="flex items-center gap-3 xl:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#0B3D2E] font-bold text-[#D4AF37]">
                G
              </div>

              <div>
                <p className="text-lg font-semibold">
                  TradeLogic
                </p>

                <p className="text-[9px] uppercase tracking-[0.18em] text-[#D4AF37]/50">
                  Dashboard
                </p>
              </div>
            </div>

            <div className="hidden xl:block">
              <p className="text-xs uppercase tracking-[0.16em] text-white/25">
                TradeLogic Control Center
              </p>
            </div>

        <div className="flex items-center gap-3">
  <ProfileMenu
    displayName={displayName}
    email={user.email ?? ""}
    firstInitial={firstInitial}
    accountStatus={accountStatus}
  />
</div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9">
          {/* Welcome */}

          <section className="relative mb-7 overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#061711]/70 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_30%,rgba(212,175,55,0.12),transparent_28%),radial-gradient(circle_at_64%_60%,rgba(34,197,94,0.08),transparent_32%)]" />

            <div className="hero-chart absolute bottom-0 right-0 top-0 hidden w-[52%] opacity-[0.28] lg:block">
              <svg
                viewBox="0 0 700 220"
                preserveAspectRatio="none"
                className="h-full w-full"
              >
                <path
                  d="M0 175 L55 150 L100 160 L145 110 L195 130 L245 80 L300 96 L350 58 L405 82 L465 40 L520 64 L580 22 L640 35 L700 5"
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth="2"
                />

                <path
                  d="M0 190 L55 165 L100 172 L145 125 L195 144 L245 95 L300 110 L350 72 L405 96 L465 55 L520 78 L580 38 L640 52 L700 20 L700 220 L0 220 Z"
                  fill="rgba(34,197,94,0.08)"
                />
              </svg>
            </div>

            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E]" />

                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#D4AF37]/75">
                    Secure Dashboard
                  </span>
                </div>

                <p className="text-lg text-white/60">
                  Welcome back,
                </p>

                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[#E7C75C] sm:text-4xl">
                  {displayName}
                </h1>

                <p className="mt-3 max-w-xl text-sm leading-6 text-white/40">
                  Manage your subscription, MT5
                  connection, trading access and TradeLogic
                  activity from one secure dashboard.
                </p>
              </div>

              <div className="w-fit rounded-2xl border border-[#22C55E]/20 bg-[#22C55E]/[0.07] px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.14em] text-white/30">
                  Account Status
                </p>

                <div className="mt-1 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#22C55E] shadow-[0_0_12px_rgba(34,197,94,0.7)]" />

                  <p className="text-sm font-semibold capitalize text-green-200">
                    {accountStatus}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ================================================= */}
          {/* LIVE TRADING CONTROL */}
          {/* ================================================= */}

          <TradingControl
            accountPanel={
            <aside className="rounded-[26px] border border-white/[0.08] bg-[#061711]/72 p-6 shadow-[0_22px_65px_rgba(0,0,0,0.2)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    Account
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    TradeLogic profile details
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 font-semibold text-[#D4AF37]">
                  {firstInitial}
                </div>
              </div>

              <div className="mt-6 space-y-5">
                <AccountRow
                  label="Full name"
                  value={displayName}
                />

                <AccountRow
                  label="Username"
                  value={profile?.username || "â€”"}
                />

                <AccountRow
                  label="Email"
                  value={user.email || "â€”"}
                />

                <AccountRow
                  label="Referral code"
                  value={
                    profile?.referral_code || "â€”"
                  }
                  highlight
                />

                <AccountRow
                  label="Account status"
                  value={accountStatus}
                  capitalize
                />
              </div>

              <div className="mt-6 rounded-2xl border border-[#D4AF37]/16 bg-[#D4AF37]/[0.045] p-4">
                <p className="text-xs font-semibold text-[#D4AF37]">
                  Referral access
                </p>

                <p className="mt-2 text-[11px] leading-5 text-white/32">
                  Your personal referral link and
                  commission statistics will appear here
                  as we connect the referral dashboard.
                </p>
              </div>
            </aside>
            }
          />

          {/* ================================================= */}
          {/* ACTIVITY */}
          {/* ================================================= */}

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-[26px] border border-white/[0.08] bg-[#061711]/72 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    Recent trading activity
                  </p>

                  <p className="mt-1 text-xs text-white/30">
                    Orders and completed trades will
                    appear here automatically.
                  </p>
                </div>

                <span className="w-fit rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] text-white/30">
                  No activity
                </span>
              </div>

              <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07]">
                <div className="grid grid-cols-4 bg-white/[0.025] px-4 py-3 text-[9px] uppercase tracking-[0.12em] text-white/25">
                  <span>Symbol</span>
                  <span>Type</span>
                  <span>Result</span>
                  <span className="text-right">
                    Status
                  </span>
                </div>

                <div className="flex min-h-[190px] items-center justify-center bg-[#03100C]/35 px-5 text-center">
                  <div className="max-w-sm">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] font-semibold text-[#D4AF37]">
                      â†—
                    </div>

                    <p className="mt-4 text-sm font-medium">
                      No trades yet
                    </p>

                    <p className="mt-2 text-xs leading-5 text-white/30">
                      Once TradeLogic starts trading,
                      positions and completed trades will
                      be synchronized here.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-[#061711]/72 p-6 backdrop-blur-xl">
              <p className="text-lg font-semibold">
                Cycle performance
              </p>

              <p className="mt-1 text-xs text-white/30">
                Profit-target progress
              </p>

              <div className="mt-7 flex justify-center">
                <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-[conic-gradient(#D4AF37_0deg,#D4AF37_0deg,rgba(255,255,255,0.06)_0deg)]">
                  <div className="flex h-[124px] w-[124px] flex-col items-center justify-center rounded-full bg-[#061711]">
                    <p className="text-2xl font-semibold">
                      0%
                    </p>

                    <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/25">
                      Progress
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <MiniStat
                  label="Starting balance"
                  value="â€”"
                />

                <MiniStat
                  label="Current equity"
                  value="â€”"
                />

                <MiniStat
                  label="Profit"
                  value="â€”"
                />

                <MiniStat
                  label="Target"
                  value="100%"
                />
              </div>
            </div>
          </section>

          <footer className="pb-3 pt-8 text-center text-[10px] text-white/18">
            TradeLogic Â· Secure automated trading access
          </footer>
        </div>
      </div>

      {/* ===================================================== */}
      {/* ANIMATIONS */}
      {/* ===================================================== */}

      <style>{`
        @keyframes tradelogicDashboardGrid {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(72px, 72px, 0);
          }
        }

        @keyframes tradelogicDashboardChart {
          0%,
          100% {
            transform: translate3d(-1.5%, 0, 0)
              scale(1.03);
          }

          50% {
            transform: translate3d(1.5%, -1%, 0)
              scale(1.055);
          }
        }

        @keyframes tradelogicHeroChart {
          0%,
          100% {
            transform: translateX(-1%);
            opacity: 0.23;
          }

          50% {
            transform: translateX(1%);
            opacity: 0.34;
          }
        }

        .dashboard-market-grid {
          background-image:
            linear-gradient(
              rgba(212, 175, 55, 0.14) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(212, 175, 55, 0.14) 1px,
              transparent 1px
            );

          background-size: 72px 72px;

          animation: tradelogicDashboardGrid 18s
            linear infinite;
        }

        .dashboard-chart {
          animation: tradelogicDashboardChart 14s
            ease-in-out infinite;
        }

        .hero-chart {
          animation: tradelogicHeroChart 7s ease-in-out
            infinite;
        }

        .performance-grid {
          background-image:
            linear-gradient(
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.08) 1px,
              transparent 1px
            );

          background-size: 48px 48px;
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-market-grid,
          .dashboard-chart,
          .hero-chart {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function SidebarItem({
  href,
  label,
  icon,
  active = false,
}: {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition ${
        active
          ? "border-[#D4AF37]/20 bg-gradient-to-r from-[#D4AF37]/10 to-[#228B22]/10 text-[#E7C75C]"
          : "border-transparent text-white/45 hover:border-white/[0.07] hover:bg-white/[0.025] hover:text-white/75"
      }`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${
          active
            ? "bg-[#D4AF37]/10 text-[#D4AF37]"
            : "bg-white/[0.03] text-white/35"
        }`}
      >
        {icon}
      </span>

      {label}
    </Link>
  );
}

function AccountRow({
  label,
  value,
  highlight = false,
  capitalize = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="border-b border-white/[0.07] pb-4 last:border-none last:pb-0">
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/25">
        {label}
      </p>

      <p
        className={`mt-2 break-all text-sm font-medium ${
          highlight
            ? "font-mono text-[#D4AF37]"
            : "text-white/70"
        } ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#03100C]/45 p-3">
      <p className="text-[9px] uppercase tracking-[0.1em] text-white/22">
        {label}
      </p>

      <p className="mt-2 text-sm font-semibold text-white/60">
        {value}
      </p>
    </div>
  );
}
