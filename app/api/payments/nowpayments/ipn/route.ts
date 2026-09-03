import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { createAdminClient } from "@/src/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

type JsonObject = {
  [key: string]: JsonValue;
};

type NowPaymentsIpnPayload = JsonObject & {
  payment_id?: string | number;
  payment_status?: string;

  actually_paid?: string | number | null;

  order_id?: string | null;

  updated_at?: string | null;
  created_at?: string | null;

  transaction_hash?: string | null;
  payin_hash?: string | null;
};

const SUPPORTED_PAYMENT_STATUSES =
  new Set([
    "waiting",
    "confirming",
    "confirmed",
    "sending",
    "partially_paid",
    "finished",
    "failed",
    "refunded",
    "expired",
  ]);

function getRequiredEnv(
  name: string
): string {
  const value = process.env[name];

  if (!value?.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}`
    );
  }

  return value.trim();
}

/*
 * -------------------------------------------------------
 * NOWPayments requires callback objects to be
 * recursively sorted alphabetically by key before
 * JSON.stringify + HMAC SHA-512.
 * -------------------------------------------------------
 */

function sortObject(
  value: JsonValue
): JsonValue {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sortObject(item)
    );
  }

  const sorted: JsonObject = {};

  Object.keys(value)
    .sort()
    .forEach((key) => {
      sorted[key] = sortObject(
        value[key]
      );
    });

  return sorted;
}

function calculateSignature(
  payload: JsonObject,
  ipnSecret: string
): string {
  const sortedPayload =
    sortObject(payload);

  const serialized =
    JSON.stringify(sortedPayload);

  return createHmac(
    "sha512",
    ipnSecret
  )
    .update(serialized)
    .digest("hex");
}

function signaturesMatch(
  receivedSignature: string,
  expectedSignature: string
): boolean {
  const received =
    receivedSignature
      .trim()
      .toLowerCase();

  const expected =
    expectedSignature
      .trim()
      .toLowerCase();

  if (
    received.length !==
    expected.length
  ) {
    return false;
  }

  try {
    return timingSafeEqual(
      Buffer.from(received, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

function normalizeNumericValue(
  value:
    | string
    | number
    | null
    | undefined
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  if (
    !Number.isFinite(numericValue)
  ) {
    return null;
  }

  return numericValue;
}

function normalizeProviderDate(
  value:
    | string
    | null
    | undefined
): string | null {
  if (!value) {
    return null;
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return null;
  }

  return parsed.toISOString();
}

export async function POST(
  request: NextRequest
) {
  const admin =
    createAdminClient();

  /*
   * -------------------------------------------------------
   * 1. Read signature
   * -------------------------------------------------------
   */

  const receivedSignature =
    request.headers.get(
      "x-nowpayments-sig"
    );

  /*
   * -------------------------------------------------------
   * 2. Read raw request body
   *
   * We read the body once and then parse it.
   * -------------------------------------------------------
   */

  let rawBody: string;

  try {
    rawBody =
      await request.text();
  } catch (error) {
    console.error(
      "Unable to read NOWPayments IPN body:",
      error
    );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 400,
      }
    );
  }

  if (!rawBody.trim()) {
    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 3. Parse JSON payload
   * -------------------------------------------------------
   */

  let payload:
    NowPaymentsIpnPayload;

  try {
    payload =
      JSON.parse(rawBody) as
        NowPaymentsIpnPayload;
  } catch {
    console.error(
      "NOWPayments IPN contained invalid JSON."
    );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 400,
      }
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 4. Store webhook event before processing
   *
   * This gives us an audit record even for invalid
   * signatures.
   * -------------------------------------------------------
   */

  const providerPaymentId =
    payload.payment_id !==
      undefined &&
    payload.payment_id !== null
      ? String(
          payload.payment_id
        )
      : null;

  const providerEventReference =
    [
      providerPaymentId,
      payload.payment_status,
      payload.updated_at,
    ]
      .filter(Boolean)
      .join(":") || null;

  const {
    data: webhookEvent,
    error: webhookInsertError,
  } = await admin
    .from(
      "payment_webhook_events"
    )
    .insert({
      provider:
        "nowpayments",

      provider_payment_id:
        providerPaymentId,

      provider_event_reference:
        providerEventReference,

      signature_received:
        receivedSignature,

      signature_valid: false,

      payload,

      processing_status:
        "received",
    })
    .select("id")
    .single();

  if (
    webhookInsertError ||
    !webhookEvent
  ) {
    console.error(
      "Unable to create NOWPayments webhook audit record:",
      webhookInsertError
    );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 500,
      }
    );
  }

  const webhookEventId =
    webhookEvent.id as string;

  /*
   * -------------------------------------------------------
   * 5. Signature must exist
   * -------------------------------------------------------
   */

  if (!receivedSignature) {
    await admin
      .from(
        "payment_webhook_events"
      )
      .update({
        processing_status:
          "ignored",

        processing_error:
          "Missing x-nowpayments-sig header",

        processed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        webhookEventId
      );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 401,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 6. Calculate expected HMAC SHA-512 signature
   * -------------------------------------------------------
   */

  const ipnSecret =
    getRequiredEnv(
      "NOWPAYMENTS_IPN_SECRET"
    );

  const expectedSignature =
    calculateSignature(
      payload,
      ipnSecret
    );

  const signatureValid =
    signaturesMatch(
      receivedSignature,
      expectedSignature
    );

  /*
   * -------------------------------------------------------
   * 7. Reject forged/invalid IPN
   * -------------------------------------------------------
   */

  if (!signatureValid) {
    await admin
      .from(
        "payment_webhook_events"
      )
      .update({
        signature_valid: false,

        processing_status:
          "ignored",

        processing_error:
          "NOWPayments HMAC signature verification failed",

        processed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        webhookEventId
      );

    console.warn(
      "Rejected NOWPayments IPN with invalid signature.",
      {
        webhookEventId,
        providerPaymentId,
      }
    );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 401,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 8. Mark audit event as cryptographically verified
   * -------------------------------------------------------
   */

  const {
    error:
      verificationUpdateError,
  } = await admin
    .from(
      "payment_webhook_events"
    )
    .update({
      signature_valid: true,

      processing_status:
        "verified",

      processing_error: null,
    })
    .eq(
      "id",
      webhookEventId
    );

  if (
    verificationUpdateError
  ) {
    console.error(
      "Unable to mark NOWPayments webhook signature as verified:",
      verificationUpdateError
    );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 500,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 9. Validate critical NOWPayments fields
   * -------------------------------------------------------
   */

  if (!providerPaymentId) {
    await admin
      .from(
        "payment_webhook_events"
      )
      .update({
        processing_status:
          "failed",

        processing_error:
          "NOWPayments payment_id is missing",

        processed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        webhookEventId
      );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 400,
      }
    );
  }

  const paymentStatus =
    payload.payment_status
      ?.trim()
      .toLowerCase();

  if (
    !paymentStatus ||
    !SUPPORTED_PAYMENT_STATUSES.has(
      paymentStatus
    )
  ) {
    await admin
      .from(
        "payment_webhook_events"
      )
      .update({
        processing_status:
          "failed",

        processing_error:
          `Unsupported payment status: ${
            paymentStatus ||
            "missing"
          }`,

        processed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        webhookEventId
      );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 400,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 10. Normalize optional provider information
   * -------------------------------------------------------
   */

  const actuallyPaid =
    normalizeNumericValue(
      payload.actually_paid
    );

  const transactionHash =
    typeof payload.transaction_hash ===
      "string"
      ? payload.transaction_hash
      : typeof payload.payin_hash ===
          "string"
        ? payload.payin_hash
        : null;

  const providerUpdatedAt =
    normalizeProviderDate(
      payload.updated_at
    );

  /*
   * -------------------------------------------------------
   * 11. Process payment through our SECURITY DEFINER RPC
   *
   * This function:
   * - locks the webhook event
   * - requires signature_valid = true
   * - locates the matching payment
   * - records payment status history
   * - updates payment details
   * - sets payment_verified only on finished
   * - safely handles repeated processed events
   * -------------------------------------------------------
   */

  const {
    error: processingError,
  } = await admin.rpc(
    "process_verified_nowpayments_status",
    {
      target_webhook_event_id:
        webhookEventId,

      target_provider_payment_id:
        providerPaymentId,

      target_payment_status:
        paymentStatus,

      target_actually_paid:
        actuallyPaid,

      target_transaction_hash:
        transactionHash,

      provider_updated_at:
        providerUpdatedAt,
    }
  );

  if (processingError) {
    console.error(
      "NOWPayments verified webhook processing failed:",
      {
        webhookEventId,
        providerPaymentId,
        paymentStatus,
        error: processingError,
      }
    );

    /*
     * The PostgreSQL function may already have
     * attempted to record a detailed error.
     *
     * We make sure the audit event is visibly
     * failed if the transaction rolled back.
     */

    await admin
      .from(
        "payment_webhook_events"
      )
      .update({
        processing_status:
          "failed",

        processing_error:
          processingError.message,

        processed_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        webhookEventId
      );

    return NextResponse.json(
      {
        received: false,
      },
      {
        status: 500,
      }
    );
  }

  /*
   * -------------------------------------------------------
   * 12. Acknowledge NOWPayments
   * -------------------------------------------------------
   */

  return NextResponse.json(
    {
      received: true,
    },
    {
      status: 200,
    }
  );
}