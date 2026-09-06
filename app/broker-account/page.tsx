import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import BrokerAccountManager from "@/src/components/broker/BrokerAccountManager";

export default async function BrokerAccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04110D] text-[#F7F7F2]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(34,139,34,0.14),transparent_32%),radial-gradient(circle_at_16%_80%,rgba(212,175,55,0.07),transparent_28%),linear-gradient(145deg,#061a14_0%,#04110d_48%,#071A2F_100%)]" />

        <div className="broker-grid absolute -inset-[120px] opacity-[0.065]" />

        <div className="absolute -right-40 top-10 h-[460px] w-[460px] rounded-full bg-[#D4AF37]/[0.045] blur-[130px]" />

        <div className="absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[#228B22]/[0.06] blur-[140px]" />
      </div>

      <header className="relative z-20 border-b border-white/[0.07] bg-[#04110D]/75 backdrop-blur-2xl">
        <div className="mx-auto flex min-h-[76px] max-w-[1400px] items-center justify-between gap-4 px-5 sm:px-7 lg:px-9">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4AF37]/40 bg-[#0B3D2E] text-base font-bold text-[#D4AF37] shadow-[0_10px_35px_rgba(0,0,0,0.3)]">
              T
            </div>

            <div>
              <p className="text-lg font-semibold tracking-tight">
                TradeLogic
              </p>

              <p className="mt-0.5 text-[8px] uppercase tracking-[0.2em] text-[#D4AF37]/55">
                Broker Connection
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.04] hover:text-[#E7C75C]"
          >
            <span aria-hidden="true">
              ←
            </span>
            Dashboard
          </Link>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-[1400px] px-5 py-8 sm:px-7 lg:px-9 lg:py-10">
        <div className="mb-6 flex items-center gap-2 text-[10px] text-white/25">
          <Link
            href="/dashboard"
            className="transition hover:text-[#D4AF37]"
          >
            Dashboard
          </Link>

          <span>/</span>

          <span className="text-white/45">
            Broker Account
          </span>
        </div>

        <section className="relative mb-6 overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#061711]/75 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_25%,rgba(212,175,55,0.11),transparent_27%),radial-gradient(circle_at_68%_70%,rgba(34,197,94,0.07),transparent_32%)]" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-1 text-[8px] font-semibold uppercase tracking-[0.15em] text-[#D4AF37]/75">
                Secure MT5 Connection
              </div>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Connect your trading account
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-white/35">
                Add the MetaTrader 5 account that
                TradeLogic will use for automated
                rule execution. Your trading password
                is encrypted before storage and is
                never displayed from your account.
              </p>
            </div>

            <div className="rounded-2xl border border-green-400/15 bg-green-400/[0.045] px-5 py-4 lg:max-w-[310px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#22C55E] shadow-[0_0_10px_rgba(34,197,94,0.65)]" />

                <p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-green-200/65">
                  Security boundary active
                </p>
              </div>

              <p className="mt-2 text-[10px] leading-5 text-white/27">
                Broker credentials are handled only
                through TradeLogic&apos;s protected
                server API. They are not directly
                writable or readable from the browser.
              </p>
            </div>
          </div>
        </section>

        <BrokerAccountManager />

        <section className="mt-6 rounded-[24px] border border-white/[0.07] bg-[#03100C]/50 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.045] text-[#D4AF37]/70">
              <svg
                viewBox="0 0 20 20"
                aria-hidden="true"
                className="h-4 w-4"
              >
                <path
                  d="M10 3.5 15 5.5v4.2c0 3.3-2 5.5-5 6.8-3-1.3-5-3.5-5-6.8V5.5l5-2Zm-2 6.2 1.3 1.3 2.8-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <p className="text-sm font-semibold text-white/65">
                Important
              </p>

              <p className="mt-2 max-w-4xl text-[11px] leading-5 text-white/27">
                Use the trading password for the MT5
                account you want TradeLogic to operate.
                Never submit your TradeLogic website
                password here. Actual MT5 verification
                becomes operational when the trading
                worker service is online.
              </p>
            </div>
          </div>
        </section>

        <footer className="pb-3 pt-8 text-center text-[10px] text-white/18">
          TradeLogic · Secure broker connection
        </footer>
      </div>

      <style>{`
        @keyframes tradelogicBrokerGrid {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(72px, 72px, 0);
          }
        }

        .broker-grid {
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

          animation:
            tradelogicBrokerGrid 20s
            linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .broker-grid {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}