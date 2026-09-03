import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";
import CryptoPaymentStarter from "@/src/components/payments/CryptoPaymentStarter";

type CheckoutPageProps = {
  searchParams: Promise<{
    plan?: string;
  }>;
};

type SubscriptionPlan = {
  id: string;
  name: string;
  billing_period: string;
  duration_months: number;
  price_usd: string;
  min_account_balance_usd: string | null;
  max_account_balance_usd: string;
  profit_target_percent: string;
  is_active: boolean;
};

function formatPlanName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatBillingPeriod(period: string) {
  if (period === "monthly") {
    return "Monthly";
  }

  if (period === "quarterly") {
    return "Quarterly";
  }

  return period.charAt(0).toUpperCase() + period.slice(1);
}

function formatMoney(value: string | null) {
  if (value === null) {
    return null;
  }

  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default async function SubscriptionCheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const planId = params.plan?.trim();

  if (!planId) {
    redirect("/subscriptions");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, username")
    .eq("id", user.id)
    .maybeSingle();

  const { data: planData, error: planError } = await supabase
    .from("subscription_plans")
    .select(
      `
        id,
        name,
        billing_period,
        duration_months,
        price_usd,
        min_account_balance_usd,
        max_account_balance_usd,
        profit_target_percent,
        is_active
      `
    )
    .eq("id", planId)
    .eq("is_active", true)
    .maybeSingle();

  if (planError || !planData) {
    redirect("/subscriptions");
  }

  const plan = planData as SubscriptionPlan;

  const minimumBalance = formatMoney(
    plan.min_account_balance_usd
  );

  const maximumBalance = formatMoney(
    plan.max_account_balance_usd
  );

  const displayName =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    user.email?.split("@")[0] ||
    "Trader";

  return (
    <main className="checkout-page">
      <div className="grid-overlay" />
      <div className="glow glow-one" />
      <div className="glow glow-two" />

      <div className="page-shell">
        <header className="topbar">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">T</span>

            <span className="brand-copy">
              <strong>TradeLogic</strong>
              <small>Secure Subscription Checkout</small>
            </span>
          </Link>

          <Link
            href="/subscriptions"
            className="back-link"
          >
            ← Change plan
          </Link>
        </header>

        <section className="checkout-layout">
          <div className="checkout-main">
            <div className="eyebrow">
              <span />
              CHECKOUT REVIEW
            </div>

            <h1>Review your TradeLogic subscription.</h1>

            <p className="intro">
              Confirm the selected plan before continuing to the
              crypto payment stage.
            </p>

            <div className="plan-card">
              <div className="plan-top">
                <div>
                  <span className="plan-label">
                    SELECTED PLAN
                  </span>

                  <h2>
                    {formatPlanName(plan.name)}
                  </h2>

                  <p>
                    {formatBillingPeriod(plan.billing_period)}
                    {" · "}
                    {plan.duration_months}{" "}
                    {plan.duration_months === 1
                      ? "month"
                      : "months"}{" "}
                    access
                  </p>
                </div>

                <div className="price-box">
                  <span>USD</span>

                  <strong>
                    ${Number(plan.price_usd).toFixed(0)}
                  </strong>
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-box">
                  <span>Trading account capacity</span>

                  <strong>
                    {minimumBalance
                      ? `${minimumBalance} – ${maximumBalance}`
                      : `Up to ${maximumBalance}`}
                  </strong>

                  <small>
                    USD-equivalent account balance
                  </small>
                </div>

                <div className="detail-box">
                  <span>Trading cycle target</span>

                  <strong>
                    {Number(
                      plan.profit_target_percent
                    ).toFixed(0)}
                    %
                  </strong>

                  <small>
                    Per qualifying paid cycle
                  </small>
                </div>
              </div>
            </div>

            <div className="account-card">
              <div>
                <span className="section-label">
                  ACCOUNT
                </span>

                <strong>{displayName}</strong>

                <small>{user.email}</small>
              </div>

              <span className="verified-badge">
                AUTHENTICATED
              </span>
            </div>

            <div className="payment-card">
              <div className="payment-heading">
                <div>
                  <span className="section-label">
                    PAYMENT METHOD
                  </span>

                  <h3>Cryptocurrency</h3>
                </div>

                <div className="crypto-mark">
                  ₿
                </div>
              </div>

              <p>
                TradeLogic subscriptions are paid through
                cryptocurrency using NOWPayments. The exact
                crypto amount and payment address will be
                generated in the next step.
              </p>
            </div>

            <div className="security-note">
              <span className="security-icon">
                ✓
              </span>

              <div>
                <strong>
                  Secure server-verified payment
                </strong>

                <p>
                  TradeLogic does not activate subscriptions
                  based on a browser redirect or payment
                  screenshot. Payment must be verified
                  server-side before subscription access is
                  activated.
                </p>
              </div>
            </div>
          </div>

          <aside className="summary-card">
            <span className="summary-label">
              ORDER SUMMARY
            </span>

            <div className="summary-plan">
              <div>
                <strong>
                  {formatPlanName(plan.name)}
                </strong>

                <span>
                  {formatBillingPeriod(
                    plan.billing_period
                  )}
                </span>
              </div>

              <strong>
                ${Number(plan.price_usd).toFixed(2)}
              </strong>
            </div>

            <div className="summary-row">
              <span>Duration</span>

              <strong>
                {plan.duration_months}{" "}
                {plan.duration_months === 1
                  ? "month"
                  : "months"}
              </strong>
            </div>

            <div className="summary-row">
              <span>Payment provider</span>

              <strong>NOWPayments</strong>
            </div>

            <div className="summary-row">
              <span>Price currency</span>

              <strong>USD</strong>
            </div>

            <div className="divider" />

            <div className="total-row">
              <span>Total</span>

              <strong>
                ${Number(plan.price_usd).toFixed(2)}
              </strong>
            </div>

            <CryptoPaymentStarter planId={plan.id} />

            <Link
              href="/subscriptions"
              className="change-plan"
            >
              Choose another plan
            </Link>
          </aside>
        </section>

        <footer className="footer">
          <span>TradeLogic</span>

          <span>
            Secure automated trading access
          </span>
        </footer>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
        }

        .checkout-page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 10% 15%,
              rgba(11,61,46,0.36),
              transparent 28%
            ),
            radial-gradient(
              circle at 88% 18%,
              rgba(7,26,47,0.82),
              transparent 31%
            ),
            #06120f;
          color: #f7f7f2;
        }

        .grid-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.14;
          background-image:
            linear-gradient(
              rgba(212,175,55,0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(212,175,55,0.08) 1px,
              transparent 1px
            );
          background-size: 55px 55px;
          animation: gridMove 18s linear infinite;
        }

        .glow {
          position: fixed;
          width: 420px;
          height: 420px;
          border-radius: 999px;
          filter: blur(105px);
          pointer-events: none;
          opacity: 0.11;
        }

        .glow-one {
          top: 25%;
          left: -190px;
          background: #d4af37;
        }

        .glow-two {
          right: -190px;
          bottom: 5%;
          background: #228b22;
        }

        .page-shell {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding-bottom: 40px;
        }

        .topbar {
          min-height: 90px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          color: inherit;
          text-decoration: none;
        }

        .brand-mark {
          display: grid;
          place-items: center;
          width: 43px;
          height: 43px;
          border-radius: 12px;
          border: 1px solid rgba(212,175,55,0.6);
          background: rgba(11,61,46,0.65);
          color: #d4af37;
          font-weight: 800;
        }

        .brand-copy {
          display: flex;
          flex-direction: column;
        }

        .brand-copy strong {
          font-size: 17px;
        }

        .brand-copy small {
          margin-top: 3px;
          color: #788781;
          font-size: 9px;
          letter-spacing: 1.3px;
          text-transform: uppercase;
        }

        .back-link {
          color: #aab5af;
          text-decoration: none;
          font-size: 12px;
        }

        .back-link:hover {
          color: #d4af37;
        }

        .checkout-layout {
          display: grid;
          grid-template-columns:
            minmax(0, 1.65fr)
            minmax(300px, 0.75fr);
          gap: 28px;
          margin-top: 60px;
          align-items: start;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #d4af37;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 2.2px;
        }

        .eyebrow span {
          width: 25px;
          height: 1px;
          background: #d4af37;
        }

        .checkout-main h1 {
          max-width: 650px;
          margin: 14px 0 12px;
          font-size: clamp(33px, 5vw, 50px);
          line-height: 1.05;
          letter-spacing: -1.8px;
        }

        .intro {
          max-width: 600px;
          margin: 0 0 30px;
          color: #89968f;
          font-size: 13px;
          line-height: 1.7;
        }

        .plan-card,
        .account-card,
        .payment-card,
        .security-note,
        .summary-card {
          border: 1px solid rgba(255,255,255,0.08);
          background:
            linear-gradient(
              145deg,
              rgba(13,39,68,0.52),
              rgba(7,26,47,0.28)
            );
          box-shadow: 0 24px 70px rgba(0,0,0,0.16);
        }

        .plan-card {
          padding: 26px;
          border-radius: 21px;
          border-color: rgba(212,175,55,0.23);
        }

        .plan-top {
          display: flex;
          justify-content: space-between;
          gap: 22px;
        }

        .plan-label,
        .section-label,
        .summary-label {
          display: block;
          color: #6d7b74;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1.7px;
        }

        .plan-top h2 {
          margin: 9px 0 5px;
          font-size: 25px;
        }

        .plan-top p {
          margin: 0;
          color: #89958f;
          font-size: 11px;
        }

        .price-box {
          text-align: right;
        }

        .price-box span {
          display: block;
          margin-bottom: 5px;
          color: #7c8882;
          font-size: 8px;
          letter-spacing: 1px;
        }

        .price-box strong {
          color: #d4af37;
          font-size: 32px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 23px;
        }

        .detail-box {
          padding: 17px;
          border-radius: 14px;
          background: rgba(4,17,13,0.34);
          border: 1px solid rgba(255,255,255,0.06);
        }

        .detail-box span,
        .detail-box strong,
        .detail-box small {
          display: block;
        }

        .detail-box span {
          margin-bottom: 8px;
          color: #6f7d76;
          font-size: 9px;
        }

        .detail-box strong {
          color: #f2e8d5;
          font-size: 16px;
        }

        .detail-box small {
          margin-top: 5px;
          color: #66736d;
          font-size: 8px;
        }

        .account-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-top: 15px;
          padding: 20px 22px;
          border-radius: 16px;
        }

        .account-card strong,
        .account-card small {
          display: block;
        }

        .account-card strong {
          margin-top: 8px;
          font-size: 13px;
        }

        .account-card small {
          margin-top: 4px;
          color: #718078;
          font-size: 10px;
        }

        .verified-badge {
          padding: 6px 9px;
          border-radius: 999px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.2);
          color: #6edb92;
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .payment-card {
          margin-top: 15px;
          padding: 22px;
          border-radius: 16px;
        }

        .payment-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .payment-heading h3 {
          margin: 8px 0 0;
          font-size: 17px;
        }

        .crypto-mark {
          display: grid;
          place-items: center;
          width: 37px;
          height: 37px;
          border-radius: 11px;
          background: rgba(212,175,55,0.07);
          border: 1px solid rgba(212,175,55,0.2);
          color: #d4af37;
          font-size: 17px;
        }

        .payment-card p {
          margin: 17px 0 0;
          color: #7a8780;
          font-size: 11px;
          line-height: 1.7;
        }

        .security-note {
          display: flex;
          gap: 13px;
          margin-top: 15px;
          padding: 18px;
          border-radius: 14px;
          background: rgba(11,61,46,0.16);
        }

        .security-icon {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 25px;
          height: 25px;
          border-radius: 50%;
          background: rgba(34,197,94,0.09);
          border: 1px solid rgba(34,197,94,0.2);
          color: #69d889;
          font-size: 10px;
        }

        .security-note strong {
          font-size: 11px;
        }

        .security-note p {
          margin: 6px 0 0;
          color: #718078;
          font-size: 9px;
          line-height: 1.65;
        }

        .summary-card {
          position: sticky;
          top: 30px;
          padding: 24px;
          border-radius: 20px;
          border-color: rgba(212,175,55,0.18);
        }

        .summary-plan {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-top: 22px;
          padding-bottom: 19px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }

        .summary-plan div strong,
        .summary-plan div span {
          display: block;
        }

        .summary-plan div strong {
          font-size: 14px;
        }

        .summary-plan div span {
          margin-top: 5px;
          color: #728078;
          font-size: 9px;
        }

        .summary-plan > strong {
          color: #d4af37;
          font-size: 16px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 18px;
          margin-top: 17px;
          color: #78867f;
          font-size: 10px;
        }

        .summary-row strong {
          color: #c9cfcb;
          font-size: 10px;
        }

        .divider {
          margin: 19px 0;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }

        .total-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .total-row span {
          color: #9aa59f;
          font-size: 11px;
        }

        .total-row strong {
          color: #f2e8d5;
          font-size: 23px;
        }

        .continue-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 22px;
          padding: 14px 15px;
          border: 0;
          border-radius: 11px;
          background: #d4af37;
          color: #06120f;
          font-size: 11px;
          font-weight: 800;
          opacity: 0.55;
          cursor: not-allowed;
        }

        .button-note {
          margin: 9px 0 0;
          text-align: center;
          color: #67746d;
          font-size: 8px;
          line-height: 1.5;
        }

        .change-plan {
          display: block;
          margin-top: 15px;
          text-align: center;
          color: #8d9a94;
          text-decoration: none;
          font-size: 9px;
        }

        .change-plan:hover {
          color: #d4af37;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          margin-top: 55px;
          padding-top: 22px;
          border-top: 1px solid rgba(255,255,255,0.06);
          color: #4f5d56;
          font-size: 9px;
        }

        @keyframes gridMove {
          from {
            transform: translateY(0);
          }

          to {
            transform: translateY(55px);
          }
        }

        @media (max-width: 900px) {
          .checkout-layout {
            grid-template-columns: 1fr;
          }

          .summary-card {
            position: static;
          }
        }

        @media (max-width: 600px) {
          .page-shell {
            width: calc(100% - 24px);
          }

          .brand-copy small {
            display: none;
          }

          .checkout-layout {
            margin-top: 44px;
          }

          .details-grid {
            grid-template-columns: 1fr;
          }

          .plan-top {
            flex-direction: column;
          }

          .price-box {
            text-align: left;
          }

          .account-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .footer {
            flex-direction: column;
            gap: 10px;
          }
        }
      `}</style>
    </main>
  );
}