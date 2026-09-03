import { createClient } from "@/src/lib/supabase/client";

export type SignUpInput = {
  email: string;
  password: string;
  fullName: string;
  username: string;
  referralCode?: string;
};

function getBrowserOrigin() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.location.origin;
}

export async function signUp({
  email,
  password,
  fullName,
  username,
  referralCode,
}: SignUpInput) {
  const supabase = createClient();

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFullName = fullName.trim();
  const normalizedUsername = username.trim();

  const normalizedReferralCode =
    referralCode?.trim().toUpperCase() || null;

  const origin = getBrowserOrigin();

  const emailRedirectTo = origin
    ? `${origin}/auth/confirm`
    : undefined;

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo,
      data: {
        full_name: normalizedFullName,
        username: normalizedUsername,
        referral_code: normalizedReferralCode,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signIn(
  email: string,
  password: string
) {
  const supabase = createClient();

  const { data, error } =
    await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOut() {
  const supabase = createClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(email: string) {
  const supabase = createClient();

  const normalizedEmail = email.trim().toLowerCase();

  const origin = getBrowserOrigin();

  const redirectTo = origin
    ? `${origin}/auth/reset-password`
    : undefined;

  const { data, error } =
    await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      }
    );

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePassword(password: string) {
  const supabase = createClient();

  const { data, error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}