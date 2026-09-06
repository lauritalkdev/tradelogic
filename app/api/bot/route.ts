import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BotRow = {
  id: string;
  user_id: string;
  broker_account_id: string;
  subscription_id: string | null;
  bot_status: string;
  strategy_name: string | null;
  assigned_worker_id: string | null;
  worker_id: string | null;
  runtime_status: string;
  started_at: string | null;
  stopped_at: string | null;
  last_heartbeat_at: string | null;
  worker_assigned_at: string | null;
  worker_last_seen_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type BrokerRow = {
  id: string;
  user_id: string;
  broker_name: string;
  mt5_server: string;
  mt5_login: number | string;
  account_currency: string | null;
  connection_status: string;
  verification_status: string;
  is_active: boolean;
  last_balance: number | string | null;
  last_equity: number | string | null;
  last_balance_usd: number | string | null;
  last_equity_usd: number | string | null;
  last_snapshot_at: string | null;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  started_at: string | null;
  expires_at: string | null;
  trading_access_status: string;
  cycle_started_at: string | null;
  starting_balance: number | string | null;
  starting_equity: number | string | null;
  current_profit_percent: number | string | null;
  profit_target_percent: number | string | null;
  created_at: string;
  updated_at: string;
};

const BOT_SELECT = `
  id,
  user_id,
  broker_account_id,
  subscription_id,
  bot_status,
  strategy_name,
  assigned_worker_id,
  worker_id,
  runtime_status,
  started_at,
  stopped_at,
  last_heartbeat_at,
  worker_assigned_at,
  worker_last_seen_at,
  last_error,
  created_at,
  updated_at
`;

const BROKER_SELECT = `
  id,
  user_id,
  broker_name,
  mt5_server,
  mt5_login,
  account_currency,
  connection_status,
  verification_status,
  is_active,
  last_balance,
  last_equity,
  last_balance_usd,
  last_equity_usd,
  last_snapshot_at
`;

const SUBSCRIPTION_SELECT = `
  id,
  user_id,
  plan_id,
  status,
  started_at,
  expires_at,
  trading_access_status,
  cycle_started_at,
  starting_balance,
  starting_equity,
  current_profit_percent,
  created_at,
  updated_at
`;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

async function getLatestBrokerAccount(userId: string) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("broker_accounts")
    .select(BROKER_SELECT)
    .eq("user_id", userId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load broker account.");
  }

  return (data as BrokerRow | null) ?? null;
}

async function getCurrentSubscription(userId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  /*
   * Prefer an active, unexpired subscription.
   *
   * A user may have historical subscriptions, so we do not simply load the
   * newest row without checking status/expiry.
   */
  const { data, error } = await admin
    .from("subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "TradeLogic subscription query error:",
      error
    );
    throw new Error("Unable to load active subscription.");
  }

  if (!data) {
    return null;
  }

  const subscription = data as Omit<
    SubscriptionRow,
    "profit_target_percent"
  >;

  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("profit_target_percent")
    .eq("id", subscription.plan_id)
    .maybeSingle();

  if (planError) {
    console.error(
      "TradeLogic subscription plan query error:",
      planError
    );
    throw new Error("Unable to load subscription plan.");
  }

  return {
    ...subscription,
    profit_target_percent:
      plan?.profit_target_percent ?? null,
  } as SubscriptionRow;
}

async function getBotForBroker(
  userId: string,
  brokerAccountId: string
) {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("bot_instances")
    .select(BOT_SELECT)
    .eq("user_id", userId)
    .eq("broker_account_id", brokerAccountId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("Unable to load TradeLogic runtime.");
  }

  return (data as BotRow | null) ?? null;
}

function safeBot(bot: BotRow | null) {
  if (!bot) {
    return null;
  }

  return {
    id: bot.id,
    brokerAccountId: bot.broker_account_id,
    subscriptionId: bot.subscription_id,
    botStatus: bot.bot_status,
    strategyName: bot.strategy_name,
    assignedWorkerId: bot.assigned_worker_id,
    runtimeStatus: bot.runtime_status,
    startedAt: bot.started_at,
    stoppedAt: bot.stopped_at,
    lastHeartbeatAt: bot.last_heartbeat_at,
    workerAssignedAt: bot.worker_assigned_at,
    workerLastSeenAt: bot.worker_last_seen_at,
    lastError: bot.last_error,
    createdAt: bot.created_at,
    updatedAt: bot.updated_at,
  };
}

function safeBroker(broker: BrokerRow | null) {
  if (!broker) {
    return null;
  }

  return {
    id: broker.id,
    brokerName: broker.broker_name,
    mt5Server: broker.mt5_server,
    mt5Login: String(broker.mt5_login),
    accountCurrency: broker.account_currency,
    connectionStatus: broker.connection_status,
    verificationStatus: broker.verification_status,
    isActive: broker.is_active,
    lastBalance: broker.last_balance,
    lastEquity: broker.last_equity,
    lastBalanceUsd: broker.last_balance_usd,
    lastEquityUsd: broker.last_equity_usd,
    lastSnapshotAt: broker.last_snapshot_at,
  };
}

function safeSubscription(
  subscription: SubscriptionRow | null
) {
  if (!subscription) {
    return null;
  }

  return {
    id: subscription.id,
    planId: subscription.plan_id,
    status: subscription.status,
    startedAt: subscription.started_at,
    expiresAt: subscription.expires_at,
    tradingAccessStatus:
      subscription.trading_access_status,
    cycleStartedAt: subscription.cycle_started_at,
    cycleStartingBalance:
      subscription.starting_balance,
    cycleStartingEquity:
      subscription.starting_equity,
    currentProfitPercent:
      subscription.current_profit_percent,
    profitTargetPercent:
      subscription.profit_target_percent,
    createdAt: subscription.created_at,
    updatedAt: subscription.updated_at,
  };
}

async function loadRuntimeState(userId: string) {
  const broker = await getLatestBrokerAccount(userId);
  const subscription = await getCurrentSubscription(userId);

  const bot = broker
    ? await getBotForBroker(userId, broker.id)
    : null;

  return {
    broker,
    subscription,
    bot,
  };
}

function statusCodeForRpcError(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("no available trading worker")
  ) {
    return 503;
  }

  if (
    normalized.includes("cannot start") ||
    normalized.includes("not active") ||
    normalized.includes("expired") ||
    normalized.includes("not connected") ||
    normalized.includes("not successfully verified") ||
    normalized.includes("not permitted") ||
    normalized.includes("balance") ||
    normalized.includes("currency conversion") ||
    normalized.includes("profit target")
  ) {
    return 409;
  }

  if (
    normalized.includes("not found")
  ) {
    return 404;
  }

  return 500;
}

function friendlyRpcMessage(
  message: string,
  fallback: string
) {
  const colonIndex = message.indexOf(":");

  if (
    message.toLowerCase().includes(
      "tradelogic cannot start:"
    ) &&
    colonIndex >= 0
  ) {
    return message.slice(colonIndex + 1).trim();
  }

  /*
   * Older database functions may still contain the internal project name.
   * Do not expose that internal name in the customer-facing UI.
   */
  return message
    .replace(/Ericbot/gi, "TradeLogic")
    .trim() || fallback;
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const {
      broker,
      subscription,
      bot,
    } = await loadRuntimeState(user.id);

    return NextResponse.json({
      broker: safeBroker(broker),
      subscription: safeSubscription(subscription),
      bot: safeBot(bot),
    });
  } catch (error) {
    console.error(
      "TradeLogic bot GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load TradeLogic trading status.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    const user = await getAuthenticatedUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const action = normalizeText(
      body.action
    ).toLowerCase();

    if (
      !["start", "stop"].includes(action)
    ) {
      return NextResponse.json(
        { error: "Unsupported bot action." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const {
      broker,
      subscription,
      bot,
    } = await loadRuntimeState(user.id);

    if (!broker) {
      return NextResponse.json(
        {
          error:
            "Add and verify your MT5 account before starting TradeLogic.",
        },
        { status: 409 }
      );
    }

    if (action === "start") {
      if (!subscription) {
        return NextResponse.json(
          {
            error:
              "An active subscription is required before starting TradeLogic.",
          },
          { status: 409 }
        );
      }

      if (!broker.is_active) {
        return NextResponse.json(
          {
            error:
              "Your MT5 account is not active.",
          },
          { status: 409 }
        );
      }

      if (
        broker.connection_status !== "connected"
      ) {
        return NextResponse.json(
          {
            error:
              "Connect your MT5 account before starting TradeLogic.",
          },
          { status: 409 }
        );
      }

      if (
        broker.verification_status !== "verified"
      ) {
        return NextResponse.json(
          {
            error:
              "Your MT5 account must be successfully verified before starting TradeLogic.",
          },
          { status: 409 }
        );
      }

      /*
       * Avoid duplicate start requests while a previous START is already
       * moving through assignment/runtime startup.
       */
      if (
        bot &&
        ["starting", "running"].includes(
          bot.bot_status
        )
      ) {
        return NextResponse.json({
          success: true,
          message:
            bot.bot_status === "running"
              ? "TradeLogic is already running."
              : "TradeLogic is already starting.",
          broker: safeBroker(broker),
          subscription:
            safeSubscription(subscription),
          bot: safeBot(bot),
        });
      }

      const { error: rpcError } =
        await admin.rpc(
          "request_bot_start",
          {
            target_subscription_id:
              subscription.id,
            target_broker_account_id:
              broker.id,
          }
        );

      if (rpcError) {
        console.error(
          "TradeLogic start RPC error:",
          rpcError
        );

        const rawMessage =
          rpcError.message ||
          "Unable to start TradeLogic.";

        return NextResponse.json(
          {
            error: friendlyRpcMessage(
              rawMessage,
              "Unable to start TradeLogic."
            ),
          },
          {
            status:
              statusCodeForRpcError(
                rawMessage
              ),
          }
        );
      }

      const refreshed =
        await loadRuntimeState(user.id);

      return NextResponse.json({
        success: true,
        message:
          "TradeLogic start request accepted. Waiting for the trading worker.",
        broker: safeBroker(
          refreshed.broker
        ),
        subscription:
          safeSubscription(
            refreshed.subscription
          ),
        bot: safeBot(
          refreshed.bot
        ),
      });
    }

    /*
     * STOP
     *
     * The database marks the bot as "stopping". The Python worker then:
     * - blocks new entries
     * - continues managing existing Strategy 1 positions
     * - marks the bot stopped and releases its worker once flat
     */
    if (!bot) {
      return NextResponse.json(
        {
          error:
            "No TradeLogic bot instance exists for this MT5 account.",
        },
        { status: 404 }
      );
    }

    if (
      bot.bot_status === "stopped"
    ) {
      return NextResponse.json({
        success: true,
        message:
          "TradeLogic is already stopped.",
        broker: safeBroker(broker),
        subscription:
          safeSubscription(subscription),
        bot: safeBot(bot),
      });
    }

    if (
      bot.bot_status === "stopping"
    ) {
      return NextResponse.json({
        success: true,
        message:
          "TradeLogic is already stopping.",
        broker: safeBroker(broker),
        subscription:
          safeSubscription(subscription),
        bot: safeBot(bot),
      });
    }

    const { error: rpcError } =
      await admin.rpc(
        "request_bot_stop",
        {
          target_broker_account_id:
            broker.id,
        }
      );

    if (rpcError) {
      console.error(
        "TradeLogic stop RPC error:",
        rpcError
      );

      const rawMessage =
        rpcError.message ||
        "Unable to stop TradeLogic.";

      return NextResponse.json(
        {
          error: friendlyRpcMessage(
            rawMessage,
            "Unable to stop TradeLogic."
          ),
        },
        {
          status:
            statusCodeForRpcError(
              rawMessage
            ),
        }
      );
    }

    const refreshed =
      await loadRuntimeState(user.id);

    return NextResponse.json({
      success: true,
      message:
        "TradeLogic stop request accepted. Existing managed positions will remain protected until the worker is safely flat.",
      broker: safeBroker(
        refreshed.broker
      ),
      subscription:
        safeSubscription(
          refreshed.subscription
        ),
      bot: safeBot(
        refreshed.bot
      ),
    });
  } catch (error) {
    console.error(
      "TradeLogic bot POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process the TradeLogic trading request.",
      },
      { status: 500 }
    );
  }
}
