import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import { createAdminClient } from "@/src/lib/supabase/admin";
import { encryptBrokerCredential } from "@/src/lib/security/broker-credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BrokerRow = {
  id: string;
  user_id: string;
  broker_name: string;
  mt5_server: string;
  mt5_login: number | string;
  mt5_password_encrypted: string;
  account_label: string | null;
  account_currency: string | null;
  account_type: string | null;
  connection_status: string;
  last_connection_error: string | null;
  last_connected_at: string | null;
  last_balance: number | string | null;
  last_equity: number | string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  verification_status: string;
  verification_error: string | null;
  verified_at: string | null;
  last_verified_at: string | null;
  last_disconnected_at: string | null;
  worker_command: string;
  worker_command_status: string;
  mt5_account_name: string | null;
  mt5_company: string | null;
  mt5_leverage: number | null;
  mt5_trade_allowed: boolean | null;
  mt5_trade_expert_allowed: boolean | null;
  last_profit: number | string | null;
  last_margin_level: number | string | null;
  last_snapshot_at: string | null;
  last_balance_usd: number | string | null;
  last_equity_usd: number | string | null;
  conversion_rate_to_usd: number | string | null;
  conversion_rate_updated_at: string | null;
};

const BROKER_SELECT = `
  id,
  user_id,
  broker_name,
  mt5_server,
  mt5_login,
  mt5_password_encrypted,
  account_label,
  account_currency,
  account_type,
  connection_status,
  last_connection_error,
  last_connected_at,
  last_balance,
  last_equity,
  is_active,
  created_at,
  updated_at,
  verification_status,
  verification_error,
  verified_at,
  last_verified_at,
  last_disconnected_at,
  worker_command,
  worker_command_status,
  mt5_account_name,
  mt5_company,
  mt5_leverage,
  mt5_trade_allowed,
  mt5_trade_expert_allowed,
  last_profit,
  last_margin_level,
  last_snapshot_at,
  last_balance_usd,
  last_equity_usd,
  conversion_rate_to_usd,
  conversion_rate_updated_at
`;

function safeBrokerAccount(row: BrokerRow | null) {
  if (!row) {
    return null;
  }

  let operationStatus:
    | "idle"
    | "connecting"
    | "disconnecting"
    | "processing"
    | "failed" = "idle";

  if (
    row.worker_command === "connect" &&
    ["pending", "processing"].includes(
      row.worker_command_status
    )
  ) {
    operationStatus = "connecting";
  } else if (
    row.worker_command === "disconnect" &&
    ["pending", "processing"].includes(
      row.worker_command_status
    )
  ) {
    operationStatus = "disconnecting";
  } else if (
    row.worker_command_status === "processing"
  ) {
    operationStatus = "processing";
  } else if (
    row.worker_command_status === "failed"
  ) {
    operationStatus = "failed";
  }

  return {
    id: row.id,
    brokerName: row.broker_name,
    mt5Server: row.mt5_server,
    mt5Login: String(row.mt5_login),
    accountLabel: row.account_label,
    accountCurrency: row.account_currency,
    accountType: row.account_type,
    connectionStatus: row.connection_status,
    verificationStatus: row.verification_status,
    connectionError:
      row.last_connection_error ||
      row.verification_error ||
      null,
    lastConnectedAt: row.last_connected_at,
    lastDisconnectedAt: row.last_disconnected_at,
    verifiedAt: row.verified_at,
    lastVerifiedAt: row.last_verified_at,
    lastBalance: row.last_balance,
    lastEquity: row.last_equity,
    lastBalanceUsd: row.last_balance_usd,
    lastEquityUsd: row.last_equity_usd,
    lastProfit: row.last_profit,
    lastMarginLevel: row.last_margin_level,
    lastSnapshotAt: row.last_snapshot_at,
    conversionRateToUsd:
      row.conversion_rate_to_usd,
    conversionRateUpdatedAt:
      row.conversion_rate_updated_at,
    mt5AccountName: row.mt5_account_name,
    mt5Company: row.mt5_company,
    mt5Leverage: row.mt5_leverage,
    mt5TradeAllowed: row.mt5_trade_allowed,
    mt5TradeExpertAllowed:
      row.mt5_trade_expert_allowed,
    passwordConfigured: Boolean(
      row.mt5_password_encrypted
    ),
    isActive: row.is_active,
    operationStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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

async function getLatestBrokerAccount(
  userId: string
) {
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
    throw new Error(
      "Unable to load broker account."
    );
  }

  return (data as BrokerRow | null) ?? null;
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
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

    const account =
      await getLatestBrokerAccount(user.id);

    return NextResponse.json({
      account: safeBrokerAccount(account),
    });
  } catch (error) {
    console.error(
      "Broker account GET error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load your broker account.",
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

    const action = normalizeText(body.action);

    if (
      !["save", "connect", "disconnect"].includes(
        action
      )
    ) {
      return NextResponse.json(
        { error: "Unsupported broker action." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    let existing =
      await getLatestBrokerAccount(user.id);

    if (action === "save") {
      const brokerName = normalizeText(
        body.brokerName
      );

      const mt5Server = normalizeText(
        body.mt5Server
      );

      const mt5Login = normalizeText(
        body.mt5Login
      );

      const mt5Password = normalizeText(
        body.mt5Password
      );

      const accountLabel = normalizeText(
        body.accountLabel
      );

      if (!brokerName) {
        return NextResponse.json(
          { error: "Broker name is required." },
          { status: 400 }
        );
      }

      if (!mt5Server) {
        return NextResponse.json(
          { error: "MT5 server is required." },
          { status: 400 }
        );
      }

      if (
        !/^\d{1,20}$/.test(mt5Login)
      ) {
        return NextResponse.json(
          {
            error:
              "MT5 login must contain numbers only.",
          },
          { status: 400 }
        );
      }

      if (brokerName.length > 120) {
        return NextResponse.json(
          {
            error:
              "Broker name is too long.",
          },
          { status: 400 }
        );
      }

      if (mt5Server.length > 160) {
        return NextResponse.json(
          {
            error:
              "MT5 server is too long.",
          },
          { status: 400 }
        );
      }

      if (accountLabel.length > 80) {
        return NextResponse.json(
          {
            error:
              "Account label is too long.",
          },
          { status: 400 }
        );
      }

      if (
        !existing &&
        !mt5Password
      ) {
        return NextResponse.json(
          {
            error:
              "MT5 trading password is required when adding an account.",
          },
          { status: 400 }
        );
      }

      const credentialsChanged =
        !existing ||
        existing.broker_name !== brokerName ||
        existing.mt5_server !== mt5Server ||
        String(existing.mt5_login) !==
          mt5Login ||
        Boolean(mt5Password);

      if (
        existing &&
        credentialsChanged &&
        ["connected", "connecting"].includes(
          existing.connection_status
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Disconnect the MT5 account before changing its connection credentials.",
          },
          { status: 409 }
        );
      }

      const encryptedPassword =
        mt5Password
          ? encryptBrokerCredential(
              mt5Password
            )
          : existing
            ? existing.mt5_password_encrypted
            : null;

      if (!encryptedPassword) {
        return NextResponse.json(
          {
            error:
              "Unable to save MT5 credentials.",
          },
          { status: 400 }
        );
      }

      const now = new Date().toISOString();

      if (existing) {
        const updates: Record<
          string,
          unknown
        > = {
          broker_name: brokerName,
          mt5_server: mt5Server,
          mt5_login: mt5Login,
          mt5_password_encrypted:
            encryptedPassword,
          account_label:
            accountLabel || null,
          updated_at: now,
        };

        if (credentialsChanged) {
          Object.assign(updates, {
            account_currency: null,
            account_type: null,
            connection_status:
              "disconnected",
            last_connection_error: null,
            verification_status:
              "unverified",
            verification_error: null,
            verified_at: null,
            last_verified_at: null,
            mt5_account_name: null,
            mt5_company: null,
            mt5_leverage: null,
            mt5_trade_allowed: null,
            mt5_trade_expert_allowed: null,
            last_balance: null,
            last_equity: null,
            last_margin: null,
            last_free_margin: null,
            last_credit: null,
            last_profit: null,
            last_margin_level: null,
            last_snapshot_at: null,
            last_balance_usd: null,
            last_equity_usd: null,
            conversion_rate_to_usd: null,
            conversion_rate_updated_at:
              null,
            worker_command: "none",
            worker_command_status: "idle",
            worker_command_updated_at:
              now,
            is_active: true,
          });
        }

        const { error } = await admin
          .from("broker_accounts")
          .update(updates)
          .eq("id", existing.id)
          .eq("user_id", user.id);

        if (error) {
          console.error(
            "Broker account update error:",
            error
          );

          return NextResponse.json(
            {
              error:
                "Unable to save broker account.",
            },
            { status: 500 }
          );
        }
      } else {
        const { error } = await admin
          .from("broker_accounts")
          .insert({
            user_id: user.id,
            broker_name: brokerName,
            mt5_server: mt5Server,
            mt5_login: mt5Login,
            mt5_password_encrypted:
              encryptedPassword,
            account_label:
              accountLabel || null,
            connection_status:
              "disconnected",
            verification_status:
              "unverified",
            worker_command: "none",
            worker_command_status: "idle",
            is_active: true,
          });

        if (error) {
          console.error(
            "Broker account insert error:",
            error
          );

          if (error.code === "23505") {
            return NextResponse.json(
              {
                error:
                  "This MT5 account has already been added.",
              },
              { status: 409 }
            );
          }

          return NextResponse.json(
            {
              error:
                "Unable to save broker account.",
            },
            { status: 500 }
          );
        }
      }

      existing =
        await getLatestBrokerAccount(user.id);

      return NextResponse.json({
        success: true,
        message:
          credentialsChanged
            ? "MT5 credentials saved securely."
            : "Broker account updated.",
        account:
          safeBrokerAccount(existing),
      });
    }

    const accountId = normalizeText(
      body.accountId
    );

    if (!accountId) {
      return NextResponse.json(
        {
          error:
            "Broker account ID is required.",
        },
        { status: 400 }
      );
    }

    const { data: ownedAccount, error } =
      await admin
        .from("broker_accounts")
        .select(
          "id, user_id, mt5_password_encrypted, connection_status"
        )
        .eq("id", accountId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
      console.error(
        "Broker ownership lookup error:",
        error
      );

      return NextResponse.json(
        {
          error:
            "Unable to verify broker account.",
        },
        { status: 500 }
      );
    }

    if (!ownedAccount) {
      return NextResponse.json(
        {
          error:
            "Broker account not found.",
        },
        { status: 404 }
      );
    }

    if (action === "connect") {
      if (
        !ownedAccount.mt5_password_encrypted
      ) {
        return NextResponse.json(
          {
            error:
              "MT5 trading credentials are incomplete.",
          },
          { status: 400 }
        );
      }

      const { error: rpcError } =
        await admin.rpc(
          "request_broker_connection",
          {
            target_broker_account_id:
              accountId,
          }
        );

      if (rpcError) {
        console.error(
          "Broker connection request error:",
          rpcError
        );

        return NextResponse.json(
          {
            error:
              "Unable to request MT5 connection.",
          },
          { status: 500 }
        );
      }

      const refreshed =
        await getLatestBrokerAccount(
          user.id
        );

      return NextResponse.json({
        success: true,
        message:
          "MT5 connection request submitted.",
        account:
          safeBrokerAccount(refreshed),
      });
    }

    const { error: rpcError } =
      await admin.rpc(
        "request_broker_disconnect",
        {
          target_broker_account_id:
            accountId,
        }
      );

    if (rpcError) {
      console.error(
        "Broker disconnect request error:",
        rpcError
      );

      return NextResponse.json(
        {
          error:
            "Unable to request MT5 disconnection.",
        },
        { status: 500 }
      );
    }

    const refreshed =
      await getLatestBrokerAccount(user.id);

    return NextResponse.json({
      success: true,
      message:
        "MT5 disconnection request submitted.",
      account:
        safeBrokerAccount(refreshed),
    });
  } catch (error) {
    console.error(
      "Broker account POST error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process your broker account request.",
      },
      { status: 500 }
    );
  }
}