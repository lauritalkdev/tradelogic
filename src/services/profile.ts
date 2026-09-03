import { createClient } from "@/src/lib/supabase/client";

export type UpdateProfileInput = {
  fullName: string;
  username: string;
};

export async function updateProfile({
  fullName,
  username,
}: UpdateProfileInput) {
  const supabase = createClient();

  const normalizedFullName = fullName.trim();
  const normalizedUsername = username.trim();

  if (!normalizedFullName) {
    throw new Error("Full name is required.");
  }

  if (!normalizedUsername) {
    throw new Error("Username is required.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Your session has expired. Please sign in again.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: normalizedFullName,
      username: normalizedUsername,
    })
    .eq("id", user.id)
    .select("id, full_name, username, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "That username is already being used. Please choose another one."
      );
    }

    throw new Error(
      error.message || "Unable to update your profile."
    );
  }

  return data;
}