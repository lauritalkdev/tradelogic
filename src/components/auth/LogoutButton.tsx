"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/src/services/auth";

export default function LogoutButton() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    try {
      setIsLoading(true);

      await signOut();

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Unable to sign out:", error);
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white/60 transition hover:border-[#D4AF37]/30 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}