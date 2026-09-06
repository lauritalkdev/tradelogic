"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

type BrokerAccount = {
  id: string;
  brokerName: string;
  mt5Server: string;
  mt5Login: string;
  accountLabel: string | null;
  accountCurrency: string | null;
  accountType: string | null;
  connectionStatus: string;
  verificationStatus: string;
  connectionError: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  verifiedAt: string | null;
  lastVerifiedAt: string | null;
  lastBalance: number | string | null;
  lastEquity: number | string | null;
  lastBalanceUsd: number | string | null;
  lastEquityUsd: number | string | null;
  lastProfit: number | string | null;
  lastMarginLevel: number | string | null;
  lastSnapshotAt: string | null;
  conversionRateToUsd:
    | number
    | string
    | null;
  conversionRateUpdatedAt: string | null;
  mt5AccountName: string | null;
  mt5Company: string | null;
  mt5Leverage: number | null;
  mt5TradeAllowed: boolean | null;
  mt5TradeExpertAllowed: boolean | null;
  passwordConfigured: boolean;
  isActive: boolean;
  operationStatus:
    | "idle"
    | "connecting"
    | "disconnecting"
    | "processing"
    | "failed";
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  account?: BrokerAccount | null;
};

export default function BrokerAccountManager() {
  const [account, setAccount] =
    useState<BrokerAccount | null>(null);

  const [brokerName, setBrokerName] =
    useState("");

  const [mt5Server, setMt5Server] =
    useState("");

  const [mt5Login, setMt5Login] =
    useState("");

  const [mt5Password, setMt5Password] =
    useState("");

  const [accountLabel, setAccountLabel] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [actionLoading, setActionLoading] =
    useState<
      "connect" | "disconnect" | null
    >(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const syncForm = useCallback(
    (nextAccount: BrokerAccount | null) => {
      if (!nextAccount) {
        return;
      }

      setBrokerName(nextAccount.brokerName);
      setMt5Server(nextAccount.mt5Server);
      setMt5Login(nextAccount.mt5Login);
      setAccountLabel(
        nextAccount.accountLabel ?? ""
      );
    },
    []
  );

  const loadAccount = useCallback(
    async (shouldSyncForm = true) => {
      try {
        const response = await fetch(
          "/api/broker-account",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load broker account."
          );
        }

        const nextAccount =
          data.account ?? null;

        setAccount(nextAccount);

        if (shouldSyncForm) {
          syncForm(nextAccount);
        }
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load broker account."
        );
      } finally {
        setLoading(false);
      }
    },
    [syncForm]
  );

  useEffect(() => {
  let cancelled = false;

  async function initializeAccount() {
    try {
      const response = await fetch(
        "/api/broker-account",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load broker account."
        );
      }

      if (cancelled) {
        return;
      }

      const nextAccount =
        data.account ?? null;

      setAccount(nextAccount);
      syncForm(nextAccount);
    } catch (caught) {
      if (cancelled) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load broker account."
      );
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  void initializeAccount();

  return () => {
    cancelled = true;
  };
}, [syncForm]);

  useEffect(() => {
    if (
      !account ||
      ![
        "connecting",
        "disconnecting",
        "processing",
      ].includes(account.operationStatus)
    ) {
      return;
    }

    const interval = window.setInterval(
      () => {
        void loadAccount(false);
      },
      5000
    );

    return () =>
      window.clearInterval(interval);
  }, [
    account,
    loadAccount,
  ]);

  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const response = await fetch(
        "/api/broker-account",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "save",
            brokerName,
            mt5Server,
            mt5Login,
            mt5Password,
            accountLabel,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save broker account."
        );
      }

      setAccount(data.account ?? null);
      syncForm(data.account ?? null);
      setMt5Password("");
      setSuccess(
        data.message ||
          "Broker account saved."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save broker account."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(
    action: "connect" | "disconnect"
  ) {
    if (!account) {
      return;
    }

    setError("");
    setSuccess("");
    setActionLoading(action);

    try {
      const response = await fetch(
        "/api/broker-account",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action,
            accountId: account.id,
          }),
        }
      );

      const data =
        (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to process broker request."
        );
      }

      setAccount(data.account ?? account);

      setSuccess(
        data.message ||
          "Broker request submitted."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to process broker request."
      );
    } finally {
      setActionLoading(null);
    }
  }

  const connectionBusy =
    account?.operationStatus ===
      "connecting" ||
    account?.operationStatus ===
      "disconnecting" ||
    account?.operationStatus ===
      "processing";

  const connected =
    account?.connectionStatus ===
    "connected";

  const credentialsLocked =
    connected ||
    account?.connectionStatus ===
      "connecting";

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-[28px] border border-white/[0.08] bg-[#061711]/75 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.24)] backdrop-blur-xl sm:p-7">
        <div className="border-b border-white/[0.07] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] text-[#D4AF37]">
              <BrokerIcon />
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white/85">
                MT5 Account
              </h2>

              <p className="mt-1 text-xs leading-5 text-white/30">
                Add the MetaTrader 5 account TradeLogic
                will connect to.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-4 py-3 text-xs leading-5 text-red-200/80">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-5 rounded-2xl border border-green-400/20 bg-green-400/[0.06] px-4 py-3 text-xs leading-5 text-green-200/80">
            {success}
          </div>
        )}

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="mt-6 space-y-5"
          >
            <Field
              label="Broker name"
              value={brokerName}
              onChange={setBrokerName}
              placeholder="e.g. Exness"
              disabled={
                saving ||
                Boolean(credentialsLocked)
              }
              required
            />

            <Field
              label="MT5 server"
              value={mt5Server}
              onChange={setMt5Server}
              placeholder="e.g. Broker-MT5Real"
              disabled={
                saving ||
                Boolean(credentialsLocked)
              }
              required
            />

            <Field
              label="MT5 login"
              value={mt5Login}
              onChange={(value) =>
                setMt5Login(
                  value.replace(/\D/g, "")
                )
              }
              placeholder="Your MT5 account number"
              inputMode="numeric"
              disabled={
                saving ||
                Boolean(credentialsLocked)
              }
              required
            />

            <div>
              <label className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/32">
                MT5 trading password
              </label>

              <input
                type="password"
                value={mt5Password}
                onChange={(event) =>
                  setMt5Password(
                    event.target.value
                  )
                }
                placeholder={
                  account?.passwordConfigured
                    ? "Leave blank to keep current password"
                    : "Enter MT5 trading password"
                }
                disabled={
                  saving ||
                  Boolean(credentialsLocked)
                }
                autoComplete="new-password"
                className="mt-2.5 w-full rounded-2xl border border-white/[0.08] bg-[#03100C]/70 px-4 py-3.5 text-sm text-white/75 outline-none transition placeholder:text-white/18 focus:border-[#D4AF37]/35 focus:bg-[#04140F]"
              />

              <p className="mt-2 text-[10px] leading-4 text-white/23">
                The password is encrypted server-side
                before storage and is never displayed
                back to you.
              </p>
            </div>

            <Field
              label="Account label"
              value={accountLabel}
              onChange={setAccountLabel}
              placeholder="Optional — e.g. Main Gold Account"
              disabled={saving}
            />

            {credentialsLocked && (
              <div className="rounded-2xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.045] px-4 py-3 text-[11px] leading-5 text-[#E7C75C]/60">
                Disconnect this MT5 account before
                changing its broker, server, login or
                trading password.
              </div>
            )}

            <button
              type="submit"
              disabled={
                saving ||
                Boolean(credentialsLocked)
              }
              className="w-full rounded-2xl bg-gradient-to-r from-[#D4AF37] via-[#E7C75C] to-[#D4AF37] px-5 py-3.5 text-xs font-bold text-[#06120F] shadow-[0_12px_35px_rgba(212,175,55,0.1)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saving
                ? "Saving securely..."
                : account
                  ? "Save Account Changes"
                  : "Save MT5 Account"}
            </button>
          </form>
        )}
      </section>

      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/[0.08] bg-[#061711]/75 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:p-7">
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-5">
            <div>
              <h2 className="text-lg font-semibold text-white/85">
                Connection
              </h2>

              <p className="mt-1 text-xs text-white/30">
                MT5 verification and connection status.
              </p>
            </div>

            <ConnectionBadge
              status={
                account?.connectionStatus ??
                "not configured"
              }
            />
          </div>

          {!account ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.025] text-white/22">
                <BrokerIcon />
              </div>

              <p className="mt-4 text-sm font-medium text-white/45">
                No MT5 account saved
              </p>

              <p className="mx-auto mt-2 max-w-xs text-[11px] leading-5 text-white/25">
                Save your broker credentials first.
                Connection controls will then become
                available.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoBox
                  label="Verification"
                  value={
                    account.verificationStatus
                  }
                  capitalize
                />

                <InfoBox
                  label="Operation"
                  value={
                    account.operationStatus
                  }
                  capitalize
                />

                <InfoBox
                  label="Broker"
                  value={account.brokerName}
                />

                <InfoBox
                  label="MT5 login"
                  value={account.mt5Login}
                  mono
                />
              </div>

              {account.connectionError && (
                <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-400/[0.045] px-4 py-3">
                  <p className="text-[9px] uppercase tracking-[0.12em] text-red-200/45">
                    Last connection error
                  </p>

                  <p className="mt-2 text-[11px] leading-5 text-red-100/65">
                    {account.connectionError}
                  </p>
                </div>
              )}

              <div className="mt-6 flex gap-3">
                {!connected ? (
                  <button
                    type="button"
                    disabled={
                      Boolean(
                        actionLoading
                      ) ||
                      connectionBusy
                    }
                    onClick={() =>
                      void handleAction(
                        "connect"
                      )
                    }
                    className="flex-1 rounded-2xl bg-[#0B3D2E] px-4 py-3.5 text-xs font-bold text-green-100/85 transition hover:bg-[#104C3A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {actionLoading ===
                      "connect" ||
                    account.operationStatus ===
                      "connecting"
                      ? "Connecting..."
                      : "Connect MT5"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      Boolean(
                        actionLoading
                      ) ||
                      connectionBusy
                    }
                    onClick={() =>
                      void handleAction(
                        "disconnect"
                      )
                    }
                    className="flex-1 rounded-2xl border border-red-400/20 bg-red-400/[0.045] px-4 py-3.5 text-xs font-bold text-red-100/70 transition hover:bg-red-400/[0.08] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {actionLoading ===
                      "disconnect" ||
                    account.operationStatus ===
                      "disconnecting"
                      ? "Disconnecting..."
                      : "Disconnect MT5"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() =>
                    void loadAccount(false)
                  }
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-xs font-semibold text-white/45 transition hover:border-[#D4AF37]/20 hover:text-[#D4AF37]"
                >
                  Refresh
                </button>
              </div>
            </>
          )}
        </section>

        {account && (
          <section className="rounded-[28px] border border-white/[0.08] bg-[#061711]/65 p-6 backdrop-blur-xl sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white/80">
                  MT5 Account Snapshot
                </h2>

                <p className="mt-1 text-xs text-white/27">
                  Values reported by the TradeLogic
                  trading worker.
                </p>
              </div>

              <span className="rounded-full border border-white/[0.06] bg-white/[0.025] px-3 py-1.5 text-[8px] uppercase tracking-[0.12em] text-white/25">
                Live data
              </span>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Metric
                label="Balance"
                value={formatMoney(
                  account.lastBalance,
                  account.accountCurrency
                )}
              />

              <Metric
                label="Equity"
                value={formatMoney(
                  account.lastEquity,
                  account.accountCurrency
                )}
              />

              <Metric
                label="Balance USD"
                value={formatUsd(
                  account.lastBalanceUsd
                )}
              />

              <Metric
                label="Equity USD"
                value={formatUsd(
                  account.lastEquityUsd
                )}
              />
            </div>

            <div className="mt-5 space-y-4 border-t border-white/[0.07] pt-5">
              <DetailRow
                label="MT5 account name"
                value={
                  account.mt5AccountName ??
                  "Awaiting verification"
                }
              />

              <DetailRow
                label="Broker company"
                value={
                  account.mt5Company ??
                  "Awaiting verification"
                }
              />

              <DetailRow
                label="Account type"
                value={
                  account.accountType ??
                  "Awaiting verification"
                }
              />

              <DetailRow
                label="Leverage"
                value={
                  account.mt5Leverage
                    ? `1:${account.mt5Leverage}`
                    : "Awaiting verification"
                }
              />

              <DetailRow
                label="Automated trading"
                value={booleanLabel(
                  account.mt5TradeExpertAllowed
                )}
              />

              <DetailRow
                label="Last snapshot"
                value={formatDateTime(
                  account.lastSnapshotAt
                )}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  inputMode?:
    | "text"
    | "numeric"
    | "decimal";
}) {
  return (
    <div>
      <label className="text-[10px] font-medium uppercase tracking-[0.13em] text-white/32">
        {label}
      </label>

      <input
        type="text"
        value={value}
        required={required}
        disabled={disabled}
        inputMode={inputMode}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className="mt-2.5 w-full rounded-2xl border border-white/[0.08] bg-[#03100C]/70 px-4 py-3.5 text-sm text-white/75 outline-none transition placeholder:text-white/18 focus:border-[#D4AF37]/35 focus:bg-[#04140F] disabled:cursor-not-allowed disabled:opacity-45"
      />
    </div>
  );
}

function ConnectionBadge({
  status,
}: {
  status: string;
}) {
  const normalized =
    status.toLowerCase();

  const good = normalized === "connected";
  const pending =
    normalized === "connecting";

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-[8px] font-semibold uppercase tracking-[0.12em] ${
        good
          ? "border-green-400/20 bg-green-400/[0.06] text-green-200/70"
          : pending
            ? "border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] text-[#E7C75C]/70"
            : "border-white/[0.07] bg-white/[0.025] text-white/35"
      }`}
    >
      {status}
    </span>
  );
}

function InfoBox({
  label,
  value,
  capitalize = false,
  mono = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#03100C]/45 p-4">
      <p className="text-[9px] uppercase tracking-[0.12em] text-white/22">
        {label}
      </p>

      <p
        className={`mt-2 break-words text-sm font-medium text-white/62 ${
          capitalize ? "capitalize" : ""
        } ${
          mono
            ? "font-mono text-xs"
            : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#03100C]/45 p-4">
      <p className="text-[9px] uppercase tracking-[0.12em] text-white/22">
        {label}
      </p>

      <p className="mt-2 text-lg font-semibold text-white/72">
        {value}
      </p>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-3 last:border-none last:pb-0">
      <span className="text-[10px] text-white/27">
        {label}
      </span>

      <span className="max-w-[60%] text-right text-[11px] font-medium text-white/55">
        {value}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="h-[68px] animate-pulse rounded-2xl border border-white/[0.05] bg-white/[0.025]" />
  );
}

function BrokerIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        d="M3.5 15V7.5L10 4l6.5 3.5V15M7 15v-4h6v4M5.5 8.5h9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatMoney(
  value: number | string | null,
  currency: string | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `${number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )} ${currency ?? ""}`.trim();
}

function formatUsd(
  value: number | string | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }
  ).format(number);
}

function formatDateTime(
  value: string | null
) {
  if (!value) {
    return "No snapshot yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat(
    "en",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(date);
}

function booleanLabel(
  value: boolean | null
) {
  if (value === true) {
    return "Allowed";
  }

  if (value === false) {
    return "Not allowed";
  }

  return "Awaiting verification";
}