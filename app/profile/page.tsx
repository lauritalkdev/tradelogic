import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import ProfileEditor from "@/src/components/profile/ProfileEditor";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      `
        id,
        full_name,
        username,
        referral_code,
        referred_by,
        account_status,
        created_at,
        updated_at
      `
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Unable to load profile:", profileError);
  }

  const displayName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    user.email?.split("@")[0] ||
    "Trader";

  const firstInitial =
    displayName.charAt(0).toUpperCase() || "T";

  const accountStatus =
    profile?.account_status ?? "active";

  const memberSince = profile?.created_at
    ? formatDate(profile.created_at)
    : "Unavailable";

  const lastUpdated = profile?.updated_at
    ? formatDate(profile.updated_at)
    : "Unavailable";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#04110D] text-[#F7F7F2]">
      {/* ===================================================== */}
      {/* BACKGROUND */}
      {/* ===================================================== */}

      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_12%,rgba(34,139,34,0.14),transparent_32%),radial-gradient(circle_at_16%_80%,rgba(212,175,55,0.07),transparent_28%),linear-gradient(145deg,#061a14_0%,#04110d_48%,#071A2F_100%)]" />

        <div className="profile-grid absolute -inset-[120px] opacity-[0.07]" />

        <div className="absolute -right-40 top-10 h-[460px] w-[460px] rounded-full bg-[#D4AF37]/[0.045] blur-[130px]" />

        <div className="absolute -left-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[#228B22]/[0.06] blur-[140px]" />
      </div>

      {/* ===================================================== */}
      {/* HEADER */}
      {/* ===================================================== */}

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
                Account Profile
              </p>
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-2.5 text-xs font-semibold text-white/55 transition hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.04] hover:text-[#E7C75C]"
          >
            <span aria-hidden="true">←</span>
            Dashboard
          </Link>
        </div>
      </header>

      {/* ===================================================== */}
      {/* CONTENT */}
      {/* ===================================================== */}

      <div className="relative z-10 mx-auto max-w-[1400px] px-5 py-8 sm:px-7 lg:px-9 lg:py-10">
        {/* Breadcrumb */}

        <div className="mb-6 flex items-center gap-2 text-[10px] text-white/25">
          <Link
            href="/dashboard"
            className="transition hover:text-[#D4AF37]"
          >
            Dashboard
          </Link>

          <span>/</span>

          <span className="text-white/45">
            My Profile
          </span>
        </div>

        {/* ================================================= */}
        {/* HERO PROFILE CARD */}
        {/* ================================================= */}

        <section className="relative overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#061711]/75 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl sm:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_25%,rgba(212,175,55,0.12),transparent_27%),radial-gradient(circle_at_68%_70%,rgba(34,197,94,0.07),transparent_32%)]" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative w-fit">
                <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37] via-[#E7C75C] to-[#A98517] text-3xl font-bold text-[#06120F] shadow-[0_18px_50px_rgba(212,175,55,0.13)]">
                  {firstInitial}
                </div>

                <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-4 border-[#061711] bg-[#22C55E]">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#22C55E]/20 bg-[#22C55E]/[0.07] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-green-200/70">
                    {accountStatus}
                  </span>

                  <span className="rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#D4AF37]/75">
                    TradeLogic Member
                  </span>
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-[#F7F7F2] sm:text-4xl">
                  {displayName}
                </h1>

                <p className="mt-2 text-sm text-white/38">
                  {user.email}
                </p>

                <p className="mt-3 text-[11px] text-white/25">
                  Member since {memberSince}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/subscriptions"
                className="rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E7C75C] to-[#D4AF37] px-5 py-3 text-xs font-bold text-[#06120F] shadow-[0_12px_35px_rgba(212,175,55,0.12)] transition hover:brightness-110"
              >
                Manage Subscription
              </Link>

              <Link
                href="/dashboard"
                className="rounded-xl border border-white/[0.09] bg-white/[0.03] px-5 py-3 text-xs font-semibold text-white/55 transition hover:border-[#D4AF37]/25 hover:text-[#E7C75C]"
              >
                Control Center
              </Link>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* MAIN PROFILE GRID */}
        {/* ================================================= */}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        
        {/* Personal information */}

<ProfileEditor
  initialFullName={profile?.full_name ?? ""}
  initialUsername={profile?.username ?? ""}
  email={user.email ?? ""}
  accountStatus={accountStatus}
/>

          {/* Account information */}

          <div className="rounded-[26px] border border-white/[0.08] bg-[#061711]/72 p-6 shadow-[0_22px_65px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
              <div>
                <p className="text-lg font-semibold">
                  Account information
                </p>

                <p className="mt-1 text-xs leading-5 text-white/30">
                  Membership and account-level details.
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#22C55E]/15 bg-[#22C55E]/[0.05] text-green-300/70">
                <ShieldIcon />
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <AccountRow
                label="Referral code"
                value={
                  profile?.referral_code ||
                  "Unavailable"
                }
                highlight
              />

              <AccountRow
                label="Member since"
                value={memberSince}
              />

              <AccountRow
                label="Last profile update"
                value={lastUpdated}
              />

              <AccountRow
                label="Account ID"
                value={user.id}
                mono
              />
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* REFERRAL */}
        {/* ================================================= */}

        <section className="mt-6 rounded-[26px] border border-[#D4AF37]/18 bg-[#061711]/72 p-6 shadow-[0_22px_65px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.065] text-[#D4AF37]">
                <ReferralIcon />
              </div>

              <div>
                <p className="text-lg font-semibold">
                  Referral account
                </p>

                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/32">
                  Your personal referral code is permanently
                  associated with your account. Referral
                  statistics and eligible commission activity
                  will be available from the dedicated
                  referral section.
                </p>
              </div>
            </div>

            <div className="min-w-[250px] rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.05] px-5 py-4">
              <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/25">
                Your referral code
              </p>

              <p className="mt-2 break-all font-mono text-base font-semibold tracking-[0.08em] text-[#E7C75C]">
                {profile?.referral_code || "Unavailable"}
              </p>
            </div>
          </div>
        </section>

        {/* ================================================= */}
        {/* ACCOUNT AREAS */}
        {/* ================================================= */}

        <section className="mt-6">
          <div className="mb-4">
            <p className="text-lg font-semibold">
              Account areas
            </p>

            <p className="mt-1 text-xs text-white/30">
              Manage the services connected to your
              TradeLogic account.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AccountAreaCard
              title="Subscription"
              description="View plans, renew access and manage your subscription."
              href="/subscriptions"
              icon="subscription"
              available
            />

            <AccountAreaCard
              title="Broker Account"
              description="Manage your MT5 broker connection and verification."
              icon="broker"
            />

            <AccountAreaCard
              title="Security"
              description="Password and additional account protection."
              icon="security"
            />

            <AccountAreaCard
              title="Support"
              description="Contact TradeLogic support and manage requests."
              icon="support"
            />
          </div>
        </section>

        {/* ================================================= */}
        {/* SECURITY NOTICE */}
        {/* ================================================= */}

        <section className="mt-6 rounded-[24px] border border-white/[0.07] bg-[#03100C]/50 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#22C55E]/15 bg-[#22C55E]/[0.045] text-green-300/70">
              <ShieldIcon />
            </div>

            <div>
              <p className="text-sm font-semibold text-white/65">
                Account security
              </p>

              <p className="mt-2 max-w-3xl text-[11px] leading-5 text-white/27">
                Never share your TradeLogic password or
                trading credentials with another person.
                Sensitive broker credentials will be handled
                separately from the public profile
                information displayed on this page.
              </p>
            </div>
          </div>
        </section>

        <footer className="pb-3 pt-8 text-center text-[10px] text-white/18">
          TradeLogic · Secure account profile
        </footer>
      </div>

      {/* ===================================================== */}
      {/* ANIMATION */}
      {/* ===================================================== */}

      <style>{`
        @keyframes tradelogicProfileGrid {
          from {
            transform: translate3d(0, 0, 0);
          }

          to {
            transform: translate3d(72px, 72px, 0);
          }
        }

        .profile-grid {
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

          animation: tradelogicProfileGrid 20s
            linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .profile-grid {
            animation: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function AccountRow({
  label,
  value,
  highlight = false,
  mono = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-white/[0.07] pb-4 last:border-none last:pb-0">
      <p className="text-[9px] uppercase tracking-[0.13em] text-white/23">
        {label}
      </p>

      <p
        className={`mt-2 break-all text-sm font-medium ${
          highlight
            ? "font-mono text-[#D4AF37]"
            : "text-white/60"
        } ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function AccountAreaCard({
  title,
  description,
  href,
  icon,
  available = false,
}: {
  title: string;
  description: string;
  href?: string;
  icon:
    | "subscription"
    | "broker"
    | "security"
    | "support";
  available?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <AccountAreaIcon type={icon} />

        {available ? (
          <span className="text-sm text-[#D4AF37]/50">
            →
          </span>
        ) : (
          <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.08em] text-white/20">
            Soon
          </span>
        )}
      </div>

      <p
        className={`mt-5 text-sm font-semibold ${
          available
            ? "text-white/70"
            : "text-white/42"
        }`}
      >
        {title}
      </p>

      <p className="mt-2 text-[10px] leading-5 text-white/25">
        {description}
      </p>
    </>
  );

  if (available && href) {
    return (
      <Link
        href={href}
        className="group rounded-[22px] border border-white/[0.08] bg-[#061711]/65 p-5 transition hover:-translate-y-0.5 hover:border-[#D4AF37]/20 hover:bg-[#D4AF37]/[0.025]"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-[22px] border border-white/[0.06] bg-[#061711]/45 p-5">
      {content}
    </div>
  );
}

function AccountAreaIcon({
  type,
}: {
  type:
    | "subscription"
    | "broker"
    | "security"
    | "support";
}) {
  const path =
    type === "subscription"
      ? "M4 6.5h12M4 10h12M4 13.5h7"
      : type === "broker"
        ? "M3.5 15V7.5L10 4l6.5 3.5V15M7 15v-4h6v4"
        : type === "security"
          ? "M10 3.5 15 5.5v4.2c0 3.3-2 5.5-5 6.8-3-1.3-5-3.5-5-6.8V5.5l5-2Zm-2 6.2 1.3 1.3 2.8-3"
          : "M4 10a6 6 0 0 1 12 0v3.5M4 10v3H2.5v-3H4Zm12 0v3h1.5v-3H16ZM15 14c-.7 1.5-2 2.2-4 2.2";

  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/[0.13] bg-[#D4AF37]/[0.05] text-[#D4AF37]/70">
      <svg
        viewBox="0 0 20 20"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function ShieldIcon() {
  return (
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
  );
}

function ReferralIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 16c.5-3 2.1-4.5 4.5-4.5s4 1.5 4.5 4.5M11 13c.8-.6 1.5-.9 2.3-.9 2.1 0 3.5 1.3 4.2 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}