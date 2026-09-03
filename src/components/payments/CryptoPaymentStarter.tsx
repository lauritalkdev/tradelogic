"use client";

import { useState } from "react";

type CryptoPaymentStarterProps = {
  planId: string;
};

type PaymentResult = {
  success: boolean;
  payment?: {
    id: string;
    orderId: string;
    providerPaymentId: string;
    status: string;
    priceAmountUsd: number;
    payCurrency: string;
    payAmount: number;
    payAddress: string;
  };
  error?: string;
};

const PAYMENT_CURRENCIES = [
  {
    value: "usdttrc20",
    label: "USDT",
    network: "TRON (TRC20)",
  },
  {
    value: "usdterc20",
    label: "USDT",
    network: "Ethereum (ERC20)",
  },
  {
    value: "usdc",
    label: "USDC",
    network: "Supported network",
  },
  {
    value: "btc",
    label: "Bitcoin",
    network: "BTC",
  },
  {
    value: "eth",
    label: "Ethereum",
    network: "ETH",
  },
  {
    value: "bnbbsc",
    label: "BNB",
    network: "BNB Smart Chain",
  },
  {
    value: "trx",
    label: "TRON",
    network: "TRX",
  },
];

export default function CryptoPaymentStarter({
  planId,
}: CryptoPaymentStarterProps) {
  const [payCurrency, setPayCurrency] =
    useState("usdttrc20");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [payment, setPayment] =
    useState<PaymentResult["payment"] | null>(
      null
    );

  async function createPayment() {
    if (loading || payment) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/payments/nowpayments/create",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            planId,
            payCurrency,
          }),
        }
      );

      const data =
        (await response.json()) as PaymentResult;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Unable to initialize payment."
        );
      }

      if (!data.payment) {
        throw new Error(
          "Payment information was not returned."
        );
      }

      setPayment(data.payment);
    } catch (paymentError) {
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : "Unable to initialize payment."
      );
    } finally {
      setLoading(false);
    }
  }

  if (payment) {
    return (
      <div className="payment-created">
        <div className="payment-created-heading">
          <span className="payment-ready-icon">
            ✓
          </span>

          <div>
            <strong>
              Crypto payment generated
            </strong>

            <small>
              Send the exact amount below.
            </small>
          </div>
        </div>

        <div className="payment-detail">
          <span>Amount to send</span>

          <strong>
            {payment.payAmount}{" "}
            {payment.payCurrency.toUpperCase()}
          </strong>
        </div>

        <div className="payment-detail">
          <span>Payment address</span>

          <code>
            {payment.payAddress}
          </code>
        </div>

        <div className="payment-detail">
          <span>Order ID</span>

          <code>
            {payment.orderId}
          </code>
        </div>

        <div className="waiting-status">
          <span className="waiting-dot" />

          Waiting for blockchain payment
        </div>

        <p className="payment-warning">
          Send only the selected cryptocurrency
          using the indicated network. Sending
          another asset or using an incompatible
          network may result in loss of funds.
        </p>

        <style>{`
          .payment-created {
            margin-top: 22px;
          }

          .payment-created-heading {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 18px;
          }

          .payment-ready-icon {
            display: grid;
            place-items: center;
            width: 29px;
            height: 29px;
            border-radius: 50%;
            background: rgba(34,197,94,0.09);
            border: 1px solid rgba(34,197,94,0.25);
            color: #6edb92;
            font-size: 11px;
          }

          .payment-created-heading strong,
          .payment-created-heading small {
            display: block;
          }

          .payment-created-heading strong {
            color: #f2e8d5;
            font-size: 11px;
          }

          .payment-created-heading small {
            margin-top: 4px;
            color: #718078;
            font-size: 8px;
          }

          .payment-detail {
            margin-top: 11px;
            padding: 12px;
            border-radius: 10px;
            background: rgba(4,17,13,0.4);
            border: 1px solid rgba(255,255,255,0.06);
          }

          .payment-detail span {
            display: block;
            margin-bottom: 6px;
            color: #6f7d76;
            font-size: 8px;
          }

          .payment-detail strong {
            color: #d4af37;
            font-size: 14px;
          }

          .payment-detail code {
            display: block;
            overflow-wrap: anywhere;
            color: #d5ddd8;
            font-size: 9px;
            line-height: 1.5;
          }

          .waiting-status {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 14px;
            color: #d4af37;
            font-size: 9px;
          }

          .waiting-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #d4af37;
            animation: paymentPulse 1.5s
              ease-in-out infinite;
          }

          .payment-warning {
            margin: 14px 0 0;
            color: #78867f;
            font-size: 8px;
            line-height: 1.6;
          }

          @keyframes paymentPulse {
            0%,
            100% {
              opacity: 0.35;
            }

            50% {
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="payment-starter">
      <label
        htmlFor="pay-currency"
        className="crypto-label"
      >
        Choose payment cryptocurrency
      </label>

      <select
        id="pay-currency"
        value={payCurrency}
        onChange={(event) =>
          setPayCurrency(event.target.value)
        }
        disabled={loading}
        className="crypto-select"
      >
        {PAYMENT_CURRENCIES.map(
          (currency) => (
            <option
              key={currency.value}
              value={currency.value}
            >
              {currency.label} —{" "}
              {currency.network}
            </option>
          )
        )}
      </select>

      {error && (
        <div className="payment-error">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={createPayment}
        disabled={loading}
        className="payment-button"
      >
        <span>
          {loading
            ? "Creating Secure Payment..."
            : "Continue to Crypto Payment"}
        </span>

        <span>
          {loading ? "•••" : "→"}
        </span>
      </button>

      <p className="payment-note">
        The exact crypto amount and payment
        address are generated securely by
        NOWPayments.
      </p>

      <style>{`
        .payment-starter {
          margin-top: 22px;
        }

        .crypto-label {
          display: block;
          margin-bottom: 8px;
          color: #89968f;
          font-size: 9px;
        }

        .crypto-select {
          width: 100%;
          padding: 12px 11px;
          border-radius: 10px;
          border: 1px solid
            rgba(212,175,55,0.18);
          outline: none;
          background: #071a16;
          color: #f2e8d5;
          font-size: 10px;
        }

        .crypto-select:focus {
          border-color:
            rgba(212,175,55,0.5);
        }

        .payment-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 12px;
          padding: 14px 15px;
          border: 0;
          border-radius: 11px;
          background: #d4af37;
          color: #06120f;
          font-size: 10px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 160ms ease,
            opacity 160ms ease;
        }

        .payment-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .payment-button:disabled {
          cursor: wait;
          opacity: 0.65;
        }

        .payment-note {
          margin: 9px 0 0;
          text-align: center;
          color: #67746d;
          font-size: 8px;
          line-height: 1.5;
        }

        .payment-error {
          margin-top: 10px;
          padding: 10px;
          border-radius: 8px;
          border: 1px solid
            rgba(239,68,68,0.2);
          background:
            rgba(239,68,68,0.06);
          color: #f08c8c;
          font-size: 9px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}