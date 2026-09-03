"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/src/services/profile";

type ProfileEditorProps = {
  initialFullName: string;
  initialUsername: string;
  email: string;
  accountStatus: string;
};

export default function ProfileEditor({
  initialFullName,
  initialUsername,
  email,
  accountStatus,
}: ProfileEditorProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialFullName);
  const [username, setUsername] = useState(initialUsername);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const hasChanges = useMemo(() => {
    return (
      fullName.trim() !== initialFullName.trim() ||
      username.trim() !== initialUsername.trim()
    );
  }, [
    fullName,
    username,
    initialFullName,
    initialUsername,
  ]);

  function beginEditing() {
    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setFullName(initialFullName);
    setUsername(initialUsername);
    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const normalizedFullName = fullName.trim();
    const normalizedUsername = username.trim();

    if (!normalizedFullName) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!normalizedUsername) {
      setErrorMessage("Please enter a username.");
      return;
    }

    if (!hasChanges) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      await updateProfile({
        fullName: normalizedFullName,
        username: normalizedUsername,
      });

      setFullName(normalizedFullName);
      setUsername(normalizedUsername);

      setSuccessMessage("Profile updated successfully.");
      setIsEditing(false);

      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your profile."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-[26px] border border-white/[0.08] bg-[#061711]/72 p-6 shadow-[0_22px_65px_rgba(0,0,0,0.2)] backdrop-blur-xl sm:p-7">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-lg font-semibold">
            Personal information
          </p>

          <p className="mt-1 text-xs leading-5 text-white/30">
            Information associated with your TradeLogic
            account.
          </p>
        </div>

        {!isEditing ? (
          <button
            type="button"
            onClick={beginEditing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] px-4 text-xs font-semibold text-[#E7C75C] transition hover:border-[#D4AF37]/40 hover:bg-[#D4AF37]/[0.09]"
          >
            <EditIcon />
            Edit profile
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-semibold text-white/45 transition hover:bg-white/[0.05] hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="submit"
              form="profile-editor-form"
              disabled={isSaving || !hasChanges}
              className="inline-flex h-10 min-w-[110px] items-center justify-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37] px-4 text-xs font-bold text-[#071A2F] shadow-[0_8px_30px_rgba(212,175,55,0.12)] transition hover:bg-[#E7C75C] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </div>
        )}
      </div>

      <form
        id="profile-editor-form"
        onSubmit={handleSubmit}
        className="mt-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <EditableField
            label="Full name"
            value={fullName}
            editing={isEditing}
            onChange={setFullName}
            autoComplete="name"
          />

          <EditableField
            label="Username"
            value={username}
            editing={isEditing}
            onChange={setUsername}
            autoComplete="username"
          />

          <ReadOnlyField
            label="Email address"
            value={email || "Unavailable"}
          />

          <ReadOnlyField
            label="Account status"
            value={accountStatus}
            capitalize
            status
          />
        </div>
      </form>

      {errorMessage ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.055] px-4 py-3"
        >
          <p className="text-xs leading-5 text-red-200/80">
            {errorMessage}
          </p>
        </div>
      ) : null}

      {successMessage ? (
        <div
          role="status"
          className="mt-5 rounded-2xl border border-green-400/15 bg-green-400/[0.05] px-4 py-3"
        >
          <p className="text-xs leading-5 text-green-200/75">
            {successMessage}
          </p>
        </div>
      ) : null}

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-[#03100C]/40 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#D4AF37]/15 bg-[#D4AF37]/[0.05] text-xs text-[#D4AF37]">
            i
          </div>

          <p className="text-[11px] leading-5 text-white/30">
            You can update your full name and username.
            Your email address, referral details and account
            status are protected account-level information.
          </p>
        </div>
      </div>
    </div>
  );
}

type EditableFieldProps = {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  autoComplete?: string;
};

function EditableField({
  label,
  value,
  editing,
  onChange,
  autoComplete,
}: EditableFieldProps) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#03100C]/35 p-4">
      <label className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
        {label}
      </label>

      {editing ? (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={!editing}
          className="mt-3 w-full rounded-xl border border-[#D4AF37]/20 bg-[#061711] px-3.5 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/20 focus:border-[#D4AF37]/45 focus:ring-2 focus:ring-[#D4AF37]/10"
        />
      ) : (
        <p className="mt-2 min-h-[22px] break-words text-sm font-medium text-white/75">
          {value || "Not provided"}
        </p>
      )}
    </div>
  );
}

type ReadOnlyFieldProps = {
  label: string;
  value: string;
  capitalize?: boolean;
  status?: boolean;
};

function ReadOnlyField({
  label,
  value,
  capitalize = false,
  status = false,
}: ReadOnlyFieldProps) {
  const normalizedStatus = value.toLowerCase();

  const statusClass =
    normalizedStatus === "active"
      ? "bg-green-400"
      : normalizedStatus === "suspended"
        ? "bg-amber-400"
        : normalizedStatus === "blocked"
          ? "bg-red-400"
          : "bg-white/30";

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#03100C]/35 p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/25">
        {label}
      </p>

      <div className="mt-2 flex min-h-[22px] items-center gap-2">
        {status ? (
          <span
            className={`h-1.5 w-1.5 rounded-full ${statusClass}`}
          />
        ) : null}

        <p
          className={`break-words text-sm font-medium text-white/75 ${
            capitalize ? "capitalize" : ""
          }`}
        >
          {value || "Unavailable"}
        </p>
      </div>
    </div>
  );
}

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path
        d="M13.5 6.5 17.5 10.5M4.8 19.2l2.7-.6 10-10a2.12 2.12 0 0 0-3-3l-10 10-.6 2.7c-.12.54.36 1.02.9.9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}