import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/src/lib/supabase/server";

type CreatePaymentRequest = {
  planId?: string;
  payCurrency?: string;
};

type PendingPaymentResult = {
  subscription_id: string;
  payment_id: string;
  order_id: string;
  amount_usd: number | string;
};

type NowPaymentsResponse = {
  payment_id?: number | string;
  payment_status?: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  created_at?: string;
  updated_at?: string;
};

const ALLOWED_PAY_CURRENCIES = new Set([
  "btc",
  "eth",
  "usdttrc20",
  "usdterc20",
  "usdc",
  "bnbbsc",
  "trx",
]);

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function buildOrderId(): string {
  const timestamp = Date.now();
  const randomPart = randomUUID()
    .replace(/-/g, "")
    .slice(0, 12)
    .toUpperCase();

  return `TRADELOGIC-${timestamp}-${randomPart}`;
}

export async function POST(request: NextRequest) {
  try {
    /*
     * -------------------------------------------------------
     * 1. Authenticate the current TradeLogic user
     * -------------------------------------------------------
     */

    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "You must be signed in to create a payment.",
        },
        {
          status: 401,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 2. Read and validate browser input
     *
     * We deliberately accept:
     * - plan UUID
     * - selected crypto
     *
     * We DO NOT accept:
     * - user ID
     * - USD price
     * - subscription ID
     * - payment status
     * -------------------------------------------------------
     */

    let body: CreatePaymentRequest;

    try {
      body = (await request.json()) as CreatePaymentRequest;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid payment request.",
        },
        {
          status: 400,
        }
      );
    }

    const planId = body.planId?.trim();
    const payCurrency = body.payCurrency
      ?.trim()
      .toLowerCase();

    if (!planId) {
      return NextResponse.json(
        {
          error: "A subscription plan is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!payCurrency) {
      return NextResponse.json(
        {
          error: "A payment cryptocurrency is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_PAY_CURRENCIES.has(payCurrency)) {
      return NextResponse.json(
        {
          error: "Unsupported payment cryptocurrency.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 3. Retrieve the authoritative plan from Supabase
     *
     * The browser never determines the subscription price.
     * -------------------------------------------------------
     */

    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select(
        `
          id,
          name,
          billing_period,
          duration_months,
          price_usd,
          is_active
        `
      )
      .eq("id", planId)
      .eq("is_active", true)
      .maybeSingle();

    if (planError) {
      console.error(
        "TradeLogic plan lookup failed:",
        planError
      );

      return NextResponse.json(
        {
          error: "Unable to verify the selected plan.",
        },
        {
          status: 500,
        }
      );
    }

    if (!plan) {
      return NextResponse.json(
        {
          error:
            "The selected subscription plan is unavailable.",
        },
        {
          status: 404,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 4. Generate our own unique TradeLogic order ID
     * -------------------------------------------------------
     */

    const orderId = buildOrderId();

    /*
     * -------------------------------------------------------
     * 5. Create pending subscription + local payment
     *
     * The RPC retrieves the authoritative price from
     * subscription_plans again inside PostgreSQL.
     * -------------------------------------------------------
     */

    const {
      data: pendingData,
      error: pendingError,
    } = await supabase.rpc(
      "create_pending_subscription_payment",
      {
        target_user_id: user.id,
        target_plan_id: plan.id,
        generated_order_id: orderId,
      }
    );

    if (pendingError) {
      console.error(
        "TradeLogic pending payment creation failed:",
        pendingError
      );

      return NextResponse.json(
        {
          error:
            "Unable to initialize the subscription payment.",
        },
        {
          status: 500,
        }
      );
    }

    const pending = (
      Array.isArray(pendingData)
        ? pendingData[0]
        : pendingData
    ) as PendingPaymentResult | null;

    if (
      !pending?.payment_id ||
      !pending?.subscription_id ||
      !pending?.order_id
    ) {
      console.error(
        "TradeLogic pending payment returned invalid data:",
        pendingData
      );

      return NextResponse.json(
        {
          error:
            "The payment could not be initialized correctly.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 6. Read server-only NOWPayments configuration
     * -------------------------------------------------------
     */

    const apiKey = getRequiredEnv(
      "NOWPAYMENTS_API_KEY"
    );

    const apiUrl = (
      process.env.NOWPAYMENTS_API_URL ||
      "https://api.nowpayments.io/v1"
    ).replace(/\/$/, "");

    /*
     * IMPORTANT:
     *
     * This is intentionally the PRODUCTION webhook URL.
     * NOWPayments should never be given localhost here.
     */

    const ipnCallbackUrl =
      "https://tradelogicbot.com/api/payments/nowpayments/ipn";

    /*
     * -------------------------------------------------------
     * 7. Create the actual NOWPayments payment
     * -------------------------------------------------------
     */

    const nowPaymentsRequest = {
      price_amount: Number(pending.amount_usd),
      price_currency: "usd",
      pay_currency: payCurrency,
      ipn_callback_url: ipnCallbackUrl,
      order_id: pending.order_id,
      order_description:
        `TradeLogic ${plan.name} ${plan.billing_period} subscription`,
    };

    let nowPaymentsResponse: Response;

    try {
      nowPaymentsResponse = await fetch(
        `${apiUrl}/payment`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },

          body: JSON.stringify(
            nowPaymentsRequest
          ),

          cache: "no-store",
        }
      );
    } catch (error) {
      console.error(
        "NOWPayments network request failed:",
        error
      );

      return NextResponse.json(
        {
          error:
            "The cryptocurrency payment provider is temporarily unavailable.",
        },
        {
          status: 502,
        }
      );
    }

    let nowPaymentsData: NowPaymentsResponse;

    try {
      nowPaymentsData =
        (await nowPaymentsResponse.json()) as NowPaymentsResponse;
    } catch {
      console.error(
        "NOWPayments returned a non-JSON response."
      );

      return NextResponse.json(
        {
          error:
            "The payment provider returned an invalid response.",
        },
        {
          status: 502,
        }
      );
    }

    if (!nowPaymentsResponse.ok) {
      console.error(
        "NOWPayments rejected payment creation:",
        nowPaymentsData
      );

      return NextResponse.json(
        {
          error:
            "NOWPayments could not create this payment.",
        },
        {
          status: 502,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 8. Validate critical NOWPayments response fields
     * -------------------------------------------------------
     */

    const providerPaymentId =
      nowPaymentsData.payment_id !== undefined
        ? String(nowPaymentsData.payment_id)
        : null;

    const providerPayCurrency =
      nowPaymentsData.pay_currency?.trim();

    const providerPayAmount =
      nowPaymentsData.pay_amount;

    const providerPayAddress =
      nowPaymentsData.pay_address?.trim();

    if (
      !providerPaymentId ||
      !providerPayCurrency ||
      providerPayAmount === undefined ||
      providerPayAmount === null ||
      !providerPayAddress
    ) {
      console.error(
        "NOWPayments response missing critical fields:",
        nowPaymentsData
      );

      return NextResponse.json(
        {
          error:
            "NOWPayments created an incomplete payment response.",
        },
        {
          status: 502,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 9. Attach NOWPayments details to our local payment
     * -------------------------------------------------------
     */

    const {
      error: attachError,
    } = await supabase.rpc(
      "attach_nowpayments_payment",
      {
        target_payment_id:
          pending.payment_id,

        nowpayments_payment_id:
          providerPaymentId,

        nowpayments_pay_currency:
          providerPayCurrency,

        nowpayments_pay_amount:
          providerPayAmount,

        nowpayments_pay_address:
          providerPayAddress,

        provider_created_at:
          nowPaymentsData.created_at || null,
      }
    );

    if (attachError) {
      /*
       * This is intentionally logged prominently.
       *
       * NOWPayments may already have created a real payment,
       * so silently creating another payment would be unsafe.
       */

      console.error(
        "CRITICAL: NOWPayments payment was created but could not be attached locally.",
        {
          localPaymentId:
            pending.payment_id,

          orderId:
            pending.order_id,

          providerPaymentId,

          error:
            attachError,
        }
      );

      return NextResponse.json(
        {
          error:
            "The payment provider created the payment, but TradeLogic could not finalize its local record. Please do not retry immediately.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * -------------------------------------------------------
     * 10. Return only the information needed by checkout
     * -------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,

        payment: {
          id:
            pending.payment_id,

          orderId:
            pending.order_id,

          providerPaymentId,

          status:
            nowPaymentsData.payment_status ||
            "waiting",

          priceAmountUsd:
            Number(pending.amount_usd),

          payCurrency:
            providerPayCurrency,

          payAmount:
            Number(providerPayAmount),

          payAddress:
            providerPayAddress,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Unexpected TradeLogic payment creation error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected payment initialization error occurred.",
      },
      {
        status: 500,
      }
    );
  }
}