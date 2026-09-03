"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/src/services/auth";

type ProfileMenuProps = {
  displayName: string;
  email: string;
  firstInitial: string;
  accountStatus: string;
};

export default function ProfileMenu({
  displayName,
  email,
  firstInitial,
  accountStatus,
}: ProfileMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

      document.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, []);

  async function handleLogout() {
    try {
      setIsSigningOut(true);

      await signOut();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Unable to sign out:", error);
      setIsSigningOut(false);
    }
  }

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="group flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-1.5 pr-2.5 transition hover:border-[#D4AF37]/25 hover:bg-[#D4AF37]/[0.04]"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37] via-[#E7C75C] to-[#A98517] text-sm font-bold text-[#06120F] shadow-[0_8px_24px_rgba(212,175,55,0.12)]">
          {firstInitial}
        </div>

        <div className="hidden min-w-0 text-left md:block">
          <p className="max-w-[150px] truncate text-xs font-semibold text-white/75">
            {displayName}
          </p>

          <p className="mt-0.5 max-w-[150px] truncate text-[9px] text-white/28">
            {email}
          </p>
        </div>

        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className={`h-3.5 w-3.5 text-white/30 transition-transform duration-200 group-hover:text-[#D4AF37] ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+12px)] z-50 w-[310px] overflow-hidden rounded-[22px] border border-white/[0.09] bg-[#061711]/[0.98] shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
        >
          <div className="relative overflow-hidden border-b border-white/[0.07] px-5 py-5">
            <div
              aria-hidden="true"
              className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#D4AF37]/[0.07] blur-3xl"
            />

            <div className="relative flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#D4AF37]/35 bg-gradient-to-br from-[#D4AF37] via-[#E7C75C] to-[#A98517] text-base font-bold text-[#06120F]">
                {firstInitial}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#F7F7F2]">
                  {displayName}
                </p>

                <p className="mt-1 truncate text-[10px] text-white/30">
                  {email}
                </p>

                <div className="mt-2 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.6)]" />

                  <span className="text-[9px] font-medium capitalize text-green-200/70">
                    {accountStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            <MenuLink
              href="/profile"
              title="My Profile"
              description="Personal and account information"
              icon="user"
              onClick={() => setIsOpen(false)}
            />

            <MenuLink
              href="/subscriptions"
              title="Subscription"
              description="Plan, renewal and trading access"
              icon="subscription"
              onClick={() => setIsOpen(false)}
            />

            <MenuItemComingSoon
              title="Broker Account"
              description="MT5 broker connection"
              icon="broker"
            />

            <MenuItemComingSoon
              title="Referral & Earnings"
              description="Referral activity and commissions"
              icon="referral"
            />

            <MenuItemComingSoon
              title="Security"
              description="Password and account protection"
              icon="security"
            />

            <MenuItemComingSoon
              title="Support"
              description="Help and support requests"
              icon="support"
            />
          </div>

          <div className="border-t border-white/[0.07] p-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isSigningOut}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-red-500/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MenuIcon type="logout" />

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-red-300/80">
                  {isSigningOut
                    ? "Signing out..."
                    : "Sign out"}
                </p>

                <p className="mt-1 text-[9px] text-white/25">
                  End your TradeLogic session
                </p>
              </div>
            </button>
          </div>

          <div className="border-t border-white/[0.05] bg-black/[0.12] px-5 py-3">
            <p className="text-center text-[8px] uppercase tracking-[0.14em] text-white/15">
              TradeLogic Secure Account
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  title,
  description,
  icon,
  onClick,
}: {
  href: string;
  title: string;
  description: string;
  icon: MenuIconType;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#D4AF37]/[0.055]"
    >
      <MenuIcon type={icon} />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/65 transition group-hover:text-[#E7C75C]">
          {title}
        </p>

        <p className="mt-1 text-[9px] text-white/24">
          {description}
        </p>
      </div>

      <span className="text-xs text-white/15 transition group-hover:translate-x-0.5 group-hover:text-[#D4AF37]/60">
        →
      </span>
    </Link>
  );
}

function MenuItemComingSoon({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon: MenuIconType;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <MenuIcon type={icon} />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-white/38">
          {title}
        </p>

        <p className="mt-1 text-[9px] text-white/18">
          {description}
        </p>
      </div>

      <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-2 py-1 text-[7px] font-semibold uppercase tracking-[0.08em] text-white/20">
        Soon
      </span>
    </div>
  );
}

type MenuIconType =
  | "user"
  | "subscription"
  | "broker"
  | "referral"
  | "security"
  | "support"
  | "logout";

function MenuIcon({
  type,
}: {
  type: MenuIconType;
}) {
  const path =
    type === "user"
      ? "M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 6c.7-2.5 2.7-4 5.5-4s4.8 1.5 5.5 4"
      : type === "subscription"
        ? "M4 6.5h12M4 10h12M4 13.5h7"
        : type === "broker"
          ? "M3.5 15V7.5L10 4l6.5 3.5V15M7 15v-4h6v4"
          : type === "referral"
            ? "M7 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm6 2a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM2.5 16c.5-3 2.1-4.5 4.5-4.5s4 1.5 4.5 4.5M11 13c.8-.6 1.5-.9 2.3-.9 2.1 0 3.5 1.3 4.2 3.9"
            : type === "security"
              ? "M10 3.5 15 5.5v4.2c0 3.3-2 5.5-5 6.8-3-1.3-5-3.5-5-6.8V5.5l5-2Zm-2 6.2 1.3 1.3 2.8-3"
              : type === "support"
                ? "M4 10a6 6 0 0 1 12 0v3.5M4 10v3H2.5v-3H4Zm12 0v3h1.5v-3H16ZM15 14c-.7 1.5-2 2.2-4 2.2"
                : "M8 4H4.5v12H8M11 7l3 3-3 3M14 10H7";

  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/[0.12] bg-[#D4AF37]/[0.045] text-[#D4AF37]/70">
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