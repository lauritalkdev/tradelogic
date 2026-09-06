"use client";

import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type BotState = {
  id: string;
  brokerAccountId: string;
  subscriptionId: string | null;
  botStatus: string;
  strategyName: string | null;
  assignedWorkerId: string | null;
  runtimeStatus: string;
  startedAt: string | null;
  stoppedAt: string | null;
  lastHeartbeatAt: string | null;
  workerAssignedAt: string | null;
  workerLastSeenAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type BrokerState = {
  id: string;
  brokerName: string;
  mt5Server: string;
  mt5Login: string;
  accountCurrency: string | null;
  connectionStatus: string;
  verificationStatus: string;
  isActive: boolean;
  lastBalance: number | string | null;
  lastEquity: number | string | null;
  lastBalanceUsd: number | string | null;
  lastEquityUsd: number | string | null;
  lastSnapshotAt: string | null;
};

type SubscriptionState = {
  id: string;
  planId: string;
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
  tradingAccessStatus: string;
  cycleStartedAt: string | null;
  cycleStartingBalance: number | string | null;
  cycleStartingEquity: number | string | null;
  currentProfitPercent: number | string | null;
  profitTargetPercent: number | string | null;
  createdAt: string;
  updatedAt: string;
};

type RuntimeResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  broker: BrokerState | null;
  subscription: SubscriptionState | null;
  bot: BotState | null;
};

type TradingControlProps = {
  accountPanel: ReactNode;
};

function normalizeStatus(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function asNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoney(
  value: number | string | null | undefined,
  currency = "USD"
) {
  const amount = asNumber(value);

  if (amount === null) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function TradingControl({
  accountPanel,
}: TradingControlProps) {
  const [runtime, setRuntime] = useState<RuntimeResponse | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<
    "start" | "stop" | null
  >(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchRuntimeState = useCallback(async () => {
    const response = await fetch("/api/bot", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const data = (await response.json()) as RuntimeResponse;

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to load trading status."
      );
    }

    return data;
  }, []);

  const loadRuntime = useCallback(async () => {
    try {
      const data = await fetchRuntimeState();
      setRuntime(data);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load trading status.";

      setNotice({
        type: "error",
        text: message,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchRuntimeState]);

  useEffect(() => {
    let active = true;

    void fetchRuntimeState()
      .then((data) => {
        if (!active) {
          return;
        }

        setRuntime(data);
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load trading status.";

        setNotice({
          type: "error",
          text: message,
        });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [fetchRuntimeState]);

  const botStatus = normalizeStatus(runtime?.bot?.botStatus);
  const runtimeStatus = normalizeStatus(
    runtime?.bot?.runtimeStatus
  );

  useEffect(() => {
    const shouldPoll = [
      "starting",
      "running",
      "stopping",
      "paused",
    ].includes(botStatus);

    if (!shouldPoll) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadRuntime();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [botStatus, loadRuntime]);

  const subscription = runtime?.subscription ?? null;
  const broker = runtime?.broker ?? null;
  const bot = runtime?.bot ?? null;

  const subscriptionReady =
    normalizeStatus(subscription?.status) === "active";

  const brokerReady =
    Boolean(broker?.isActive) &&
    normalizeStatus(broker?.connectionStatus) === "connected" &&
    normalizeStatus(broker?.verificationStatus) === "verified";

  const botRunning = botStatus === "running";
  const botStarting = botStatus === "starting";
  const botStopping = botStatus === "stopping";
  const botPaused = botStatus === "paused";

  const tradingAccessStatus = normalizeStatus(
    subscription?.tradingAccessStatus
  );

  const profitTargetReached =
    tradingAccessStatus === "profit_target_reached";

  const safetyPaused =
    botPaused && tradingAccessStatus === "running";

  const setupCompleteCount =
    Number(subscriptionReady) +
    Number(brokerReady) +
    Number(botRunning);

  const startAllowed =
    subscriptionReady &&
    brokerReady &&
    !botStarting &&
    !botRunning &&
    !botStopping &&
    !safetyPaused &&
    !profitTargetReached &&
    !actionPending;

  const stopAllowed =
    Boolean(bot) &&
    !botStopping &&
    botStatus !== "stopped" &&
    !actionPending;

  const cycleStarted = Boolean(subscription?.cycleStartedAt);

  const currentProfitPercent =
    asNumber(subscription?.currentProfitPercent) ?? 0;

  const targetProfitPercent =
    asNumber(subscription?.profitTargetPercent) ?? 100;

  const progressPercent =
    targetProfitPercent > 0
      ? clamp(
          (currentProfitPercent / targetProfitPercent) * 100,
          0,
          100
        )
      : 0;

  const accountCurrency =
    broker?.accountCurrency?.trim().toUpperCase() || "USD";

  const currentEquity =
    broker?.lastEquity ?? broker?.lastBalance ?? null;

  const profitAmount = useMemo(() => {
    const start = asNumber(subscription?.cycleStartingEquity);
    const current = asNumber(currentEquity);

    if (start === null || current === null) {
      return null;
    }

    return current - start;
  }, [subscription?.cycleStartingEquity, currentEquity]);

  const subscriptionCard = useMemo(() => {
    if (loading) {
      return {
        value: "Loading...",
        status: "Checking",
        description: "Checking your current subscription.",
      };
    }

    if (!subscription) {
      return {
        value: "No active plan",
        status: "Inactive",
        description: "Choose a plan to activate trading access.",
      };
    }

    if (profitTargetReached) {
      return {
        value: "Cycle target reached",
        status: "New plan required",
        description:
          "This paid trading cycle reached its profit target.",
      };
    }

    return {
      value: "Active subscription",
      status: "Active",
      description:
        subscription.expiresAt
          ? `Trading access expires ${formatDate(
              subscription.expiresAt
            )}.`
          : "Your subscription is active.",
    };
  }, [loading, profitTargetReached, subscription]);

  const brokerCard = useMemo(() => {
    if (loading) {
      return {
        value: "Loading...",
        status: "Checking",
        description: "Checking your MT5 connection.",
      };
    }

    if (!broker) {
      return {
        value: "Not connected",
        status: "Disconnected",
        description: "No trading account is currently linked.",
      };
    }

    if (!brokerReady) {
      return {
        value: broker.brokerName || "MT5 account",
        status: titleCase(
          broker.verificationStatus || broker.connectionStatus
        ),
        description:
          "Complete MT5 connection and verification before trading.",
      };
    }

    return {
      value: broker.brokerName || "MT5 connected",
      status: "Verified",
      description: `${broker.mt5Server} · Login ${broker.mt5Login}`,
    };
  }, [broker, brokerReady, loading]);

  const botCard = useMemo(() => {
    if (loading) {
      return {
        value: "Loading...",
        status: "Checking",
        description: "Checking TradeLogic runtime.",
      };
    }

    if (!bot) {
      return {
        value: "Stopped",
        status: "Offline",
        description: "Automation has not started.",
      };
    }

    if (botStarting) {
      return {
        value: "Starting",
        status:
          runtimeStatus === "waiting_for_worker"
            ? "Worker assigned"
            : titleCase(runtimeStatus || "Starting"),
        description:
          "TradeLogic is preparing the automated trading runtime.",
      };
    }

    if (botRunning) {
      return {
        value: "Running",
        status: "Online",
        description:
          "TradeLogic is monitoring Strategy 1 continuously.",
      };
    }

    if (botStopping) {
      return {
        value: "Stopping",
        status: "Closing safely",
        description:
          "New entries are blocked while existing positions remain managed.",
      };
    }

    if (safetyPaused) {
      return {
        value: "Paused",
        status: "Safety pause",
        description:
          "New entries are temporarily paused by TradeLogic safety controls.",
      };
    }

    if (botStatus === "error") {
      return {
        value: "Error",
        status: "Attention required",
        description:
          bot.lastError ||
          "The trading runtime reported an error.",
      };
    }

    return {
      value: titleCase(botStatus || "Stopped"),
      status: titleCase(runtimeStatus || "Offline"),
      description:
        bot.lastError ||
        "TradeLogic is not currently opening new positions.",
    };
  }, [
    bot,
    botRunning,
    botStarting,
    botStatus,
    botStopping,
    loading,
    runtimeStatus,
    safetyPaused,
  ]);

  const cycleCard = useMemo(() => {
    if (loading) {
      return {
        value: "Loading...",
        status: "Checking",
        description: "Checking trading-cycle status.",
      };
    }

    if (!subscription || !cycleStarted) {
      return {
        value: "Not started",
        status: "Waiting",
        description: "Cycle data appears after activation.",
      };
    }

    if (profitTargetReached) {
      return {
        value: "100% target reached",
        status: "Complete",
        description:
          "A new paid subscription is required for another cycle.",
      };
    }

    return {
      value: `${currentProfitPercent.toFixed(2)}%`,
      status: titleCase(
        subscription.tradingAccessStatus || "Available"
      ),
      description: `Target: ${targetProfitPercent.toFixed(0)}% profit for this paid cycle.`,
    };
  }, [
    currentProfitPercent,
    cycleStarted,
    loading,
    profitTargetReached,
    subscription,
    targetProfitPercent,
  ]);

  async function submitAction(action: "start" | "stop") {
    setActionPending(action);
    setNotice(null);

    try {
      const response = await fetch("/api/bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as RuntimeResponse;

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Unable to ${action} TradeLogic.`
        );
      }

      setRuntime(data);
      setNotice({
        type: "success",
        text:
          data.message ||
          (action === "start"
            ? "TradeLogic start request accepted."
            : "TradeLogic stop request accepted."),
      });

      window.setTimeout(() => {
        void loadRuntime();
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Unable to ${action} TradeLogic.`;

      setNotice({
        type: "error",
        text: message,
      });
    } finally {
      setActionPending(null);
    }
  }

  const primaryControl = useMemo(() => {
    if (actionPending === "start" || botStarting) {
      return {
        label: "Starting TradeLogic...",
        disabled: true,
        action: null as "start" | "stop" | null,
      };
    }

    if (actionPending === "stop" || botStopping) {
      return {
        label: "Stopping TradeLogic...",
        disabled: true,
        action: null as "start" | "stop" | null,
      };
    }

    if (botRunning) {
      return {
        label: "Stop Trading",
        disabled: !stopAllowed,
        action: "stop" as const,
      };
    }

    if (safetyPaused) {
      return {
        label: "Paused by Safety Controls",
        disabled: true,
        action: null,
      };
    }

    if (profitTargetReached) {
      return {
        label: "Profit Target Reached",
        disabled: true,
        action: null,
      };
    }

    return {
      label: brokerReady
        ? subscriptionReady
          ? "Start Trading"
          : "Subscription Required"
        : "Complete Setup",
      disabled: !startAllowed,
      action: startAllowed ? ("start" as const) : null,
    };
  }, [
    actionPending,
    botRunning,
    botStarting,
    botStopping,
    brokerReady,
    profitTargetReached,
    safetyPaused,
    startAllowed,
    stopAllowed,
    subscriptionReady,
  ]);

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RuntimeMetricCard
          label="Subscription"
          value={subscriptionCard.value}
          description={subscriptionCard.description}
          icon="$"
          status={subscriptionCard.status}
          positive={subscriptionReady && !profitTargetReached}
        />

        <RuntimeMetricCard
          label="MT5 Account"
          value={brokerCard.value}
          description={brokerCard.description}
          icon="MT5"
          status={brokerCard.status}
          positive={brokerReady}
        />

        <RuntimeMetricCard
          label="TradeLogic"
          value={botCard.value}
          description={botCard.description}
          icon="G"
          status={botCard.status}
          positive={botRunning}
          warning={botStarting || botStopping || safetyPaused}
        />

        <RuntimeMetricCard
          label="Trading Cycle"
          value={cycleCard.value}
          description={cycleCard.description}
          icon="%"
          status={cycleCard.status}
          positive={cycleStarted && !profitTargetReached}
          warning={profitTargetReached}
        />
      </section>

      {notice && (
        <div
          className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${
            notice.type === "success"
              ? "border-[#22C55E]/20 bg-[#22C55E]/[0.07] text-green-200"
              : "border-[#EF4444]/20 bg-[#EF4444]/[0.07] text-red-200"
          }`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          {notice.text}
        </div>
      )}

      <section className="mt-6 grid gap-6 2xl:grid-cols-[1.45fr_0.75fr]">
        <div className="rounded-[26px] border border-white/[0.08] bg-[#061711]/72 p-6 shadow-[0_22px_65px_rgba(0,0,0,0.2)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                TradeLogic setup
              </p>

              <p className="mt-1 text-sm text-white/35">
                Complete the required steps before automated trading
                becomes available.
              </p>
            </div>

            <span className="w-fit rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] px-3 py-1.5 text-[11px] font-semibold text-[#D4AF37]">
              {setupCompleteCount} of 3 complete
            </span>
          </div>

          <div className="mt-6 space-y-3">
            <RuntimeSetupStep
              number="1"
              title="Choose your subscription"
              description={
                subscriptionReady
                  ? subscription?.expiresAt
                    ? `Active until ${formatDate(
                        subscription.expiresAt
                      )}.`
                    : "Your paid subscription is active."
                  : "Select Beginner, Intermediate or Advanced."
              }
              complete={subscriptionReady}
              active={!subscriptionReady}
              href="/subscriptions"
              action={
                subscriptionReady ? "View plan" : "View plans"
              }
            />

            <RuntimeSetupStep
              number="2"
              title="Connect your MT5 account"
              description={
                brokerReady
                  ? `${broker?.brokerName ?? "Broker"} · ${
                      broker?.mt5Server ?? "MT5"
                    }`
                  : "Add your broker, server and MT5 credentials, then verify the connection."
              }
              complete={brokerReady}
              active={subscriptionReady && !brokerReady}
              href="/broker-account"
              action={
                brokerReady ? "Manage MT5" : "Connect MT5"
              }
            />

            <RuntimeSetupStep
              number="3"
              title="Start TradeLogic"
              description={
                botRunning
                  ? "Automated market monitoring is active."
                  : botStarting
                    ? "The assigned trading worker is preparing your runtime."
                    : botStopping
                      ? "TradeLogic is stopping safely."
                      : safetyPaused
                        ? "New entries are temporarily paused by safety controls."
                        : profitTargetReached
                          ? "This paid trading cycle reached its profit target."
                          : "Start automated trading after all eligibility checks pass."
              }
              complete={botRunning}
              active={
                subscriptionReady &&
                brokerReady &&
                !botRunning &&
                !profitTargetReached
              }
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#03100C]/55 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  Trading runtime
                </p>

                <p className="mt-1 text-xs leading-5 text-white/30">
                  Live account, cycle and worker status from TradeLogic.
                </p>
              </div>

              <span
                className={`w-fit rounded-lg border px-3 py-1.5 text-[10px] font-semibold ${
                  botRunning
                    ? "border-[#22C55E]/20 bg-[#22C55E]/[0.07] text-green-200"
                    : botStarting || botStopping || safetyPaused
                      ? "border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] text-[#E7C75C]"
                      : "border-white/[0.08] bg-white/[0.03] text-white/35"
                }`}
              >
                {bot
                  ? titleCase(
                      runtimeStatus || botStatus || "Stopped"
                    )
                  : "Not started"}
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <RuntimeMiniStat
                label="Starting balance"
                value={formatMoney(
                  subscription?.cycleStartingBalance,
                  accountCurrency
                )}
              />

              <RuntimeMiniStat
                label="Current equity"
                value={formatMoney(
                  currentEquity,
                  accountCurrency
                )}
              />

              <RuntimeMiniStat
                label="Cycle profit"
                value={formatMoney(
                  profitAmount,
                  accountCurrency
                )}
              />

              <RuntimeMiniStat
                label="Target"
                value={`${targetProfitPercent.toFixed(0)}%`}
              />
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between gap-4">
                <span className="text-[10px] uppercase tracking-[0.12em] text-white/25">
                  Profit-target progress
                </span>

                <span className="text-xs font-semibold text-[#D4AF37]">
                  {currentProfitPercent.toFixed(2)}%
                </span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0B3D2E] via-[#22C55E] to-[#D4AF37] transition-[width] duration-700"
                  style={{
                    width: `${progressPercent}%`,
                  }}
                />
              </div>
            </div>

            {bot?.lastError && (
              <div className="mt-5 rounded-xl border border-[#EF4444]/18 bg-[#EF4444]/[0.055] px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-red-200/70">
                  Runtime message
                </p>
                <p className="mt-1 text-xs leading-5 text-red-100/70">
                  {bot.lastError}
                </p>
              </div>
            )}
          </div>
        </div>

        {accountPanel}
      </section>

      <section className="relative mt-6 overflow-hidden rounded-[26px] border border-[#D4AF37]/25 bg-[#061711]/80 p-6 sm:p-7">
        <div className="absolute right-0 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-[#D4AF37]/[0.07] blur-[80px]" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-4 py-3 text-lg font-bold text-[#D4AF37]">
              G
            </div>

            <div>
              <p className="text-lg font-semibold">
                {botRunning
                  ? "TradeLogic is trading"
                  : botStarting
                    ? "TradeLogic is starting"
                    : botStopping
                      ? "TradeLogic is stopping safely"
                      : safetyPaused
                        ? "TradeLogic safety pause"
                        : profitTargetReached
                          ? "Trading cycle complete"
                          : "Prepare TradeLogic for trading"}
              </p>

              <p className="mt-2 max-w-2xl text-xs leading-5 text-white/35">
                {botRunning
                  ? "Your assigned worker is monitoring the configured Strategy 1 markets. You can request a safe stop at any time."
                  : botStarting
                    ? "Your start request was accepted and TradeLogic is waiting for the assigned worker to confirm the runtime."
                    : botStopping
                      ? "No new entries will be opened. Existing managed positions remain protected until the worker is safely flat."
                      : safetyPaused
                        ? "New entries are temporarily blocked while existing positions continue to be managed according to the safety rules."
                        : profitTargetReached
                          ? "This paid trading cycle has reached its configured profit target. A new subscription is required before another cycle can begin."
                          : "Activate your subscription, connect and verify MT5, then start automated trading after the eligibility checks pass."}
              </p>

              {bot?.assignedWorkerId && (
                <p className="mt-2 text-[10px] text-white/20">
                  Runtime assigned · Last worker contact{" "}
                  {bot.workerLastSeenAt
                    ? formatDate(bot.workerLastSeenAt)
                    : "pending"}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!subscriptionReady && (
              <Link
                href="/subscriptions"
                className="rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 py-3 text-xs font-semibold text-white/65 transition hover:border-[#D4AF37]/25 hover:text-white"
              >
                View plans
              </Link>
            )}

            {subscriptionReady && !brokerReady && (
              <Link
                href="/broker-account"
                className="rounded-xl border border-white/[0.1] bg-white/[0.035] px-5 py-3 text-xs font-semibold text-white/65 transition hover:border-[#D4AF37]/25 hover:text-white"
              >
                Connect MT5
              </Link>
            )}

            <button
              type="button"
              disabled={primaryControl.disabled}
              onClick={() => {
                if (primaryControl.action) {
                  void submitAction(primaryControl.action);
                }
              }}
              className={`w-fit rounded-xl px-6 py-3 text-xs font-bold transition ${
                primaryControl.disabled
                  ? "cursor-not-allowed border border-white/[0.08] bg-white/[0.04] text-white/30"
                  : primaryControl.action === "stop"
                    ? "border border-[#EF4444]/30 bg-[#EF4444]/10 text-red-200 hover:bg-[#EF4444]/15"
                    : "bg-gradient-to-r from-[#D4AF37] via-[#E7C75C] to-[#D4AF37] text-[#06120F] shadow-[0_12px_35px_rgba(212,175,55,0.13)] hover:brightness-110"
              }`}
            >
              {primaryControl.label}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function RuntimeMetricCard({
  label,
  value,
  description,
  icon,
  status,
  positive = false,
  warning = false,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
  status: string;
  positive?: boolean;
  warning?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#061711]/72 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#D4AF37]/20">
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#D4AF37]/[0.035] blur-2xl transition group-hover:bg-[#D4AF37]/[0.06]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-white/28">
              {label}
            </p>

            <p className="mt-3 text-xl font-semibold">
              {value}
            </p>
          </div>

          <div className="flex h-10 min-w-10 items-center justify-center rounded-xl border border-[#D4AF37]/15 bg-[#D4AF37]/[0.055] px-2 text-[10px] font-bold text-[#D4AF37]">
            {icon}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              positive
                ? "bg-[#22C55E] shadow-[0_0_8px_rgba(34,197,94,0.55)]"
                : warning
                  ? "bg-[#D4AF37]"
                  : "bg-white/25"
            }`}
          />

          <span
            className={`text-[10px] font-medium ${
              positive
                ? "text-green-200/70"
                : warning
                  ? "text-[#E7C75C]/75"
                  : "text-white/32"
            }`}
          >
            {status}
          </span>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-white/28">
          {description}
        </p>
      </div>
    </div>
  );
}

function RuntimeSetupStep({
  number,
  title,
  description,
  active = false,
  complete = false,
  href,
  action,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
  complete?: boolean;
  href?: string;
  action?: string;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 transition ${
        complete
          ? "border-[#22C55E]/16 bg-[#22C55E]/[0.04]"
          : active
            ? "border-[#D4AF37]/18 bg-[#D4AF37]/[0.045]"
            : "border-white/[0.07] bg-white/[0.018]"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${
          complete
            ? "border-[#22C55E]/30 bg-[#22C55E]/10 text-green-200"
            : active
              ? "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#D4AF37]"
              : "border-white/[0.08] bg-white/[0.025] text-white/30"
        }`}
      >
        {complete ? "✓" : number}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 text-[11px] leading-5 text-white/30">
          {description}
        </p>
      </div>

      {href && action && (
        <Link
          href={href}
          className="hidden rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.08] px-4 py-2.5 text-[11px] font-semibold text-[#E7C75C] transition hover:bg-[#D4AF37]/[0.13] sm:block"
        >
          {action}
        </Link>
      )}
    </div>
  );
}

function RuntimeMiniStat({
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

      <p className="mt-2 break-words text-sm font-semibold text-white/60">
        {value}
      </p>
    </div>
  );
}
