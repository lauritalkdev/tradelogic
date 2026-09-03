import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase/server";

type SubscriptionPlan = {
  id: string;
  name: string;
  billing_period: string;
  duration_months: number;
  price_usd: string;
  is_active: boolean;
  min_account_balance_usd: string | null;
  max_account_balance_usd: string;
  profit_target_percent: string;
};

function formatPlanName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
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

function getPlanDescription(name: string) {
  switch (name.toLowerCase()) {
    case "beginner":
      return "A focused starting point for smaller trading accounts.";

    case "intermediate":
      return "More trading capacity for growing account sizes.";

    case "advanced":
      return "Built for larger accounts requiring higher trading capacity.";

    default:
      return "Automated rule-based trading access.";
  }
}

function getPlanNumber(name: string) {
  switch (name.toLowerCase()) {
    case "beginner":
      return "01";

    case "intermediate":
      return "02";

    case "advanced":
      return "03";

    default:
      return "00";
  }
}

export default async function SubscriptionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("subscription_plans")
    .select(
      `
        id,
        name,
        billing_period,
        duration_months,
        price_usd,
        is_active,
        min_account_balance_usd,
        max_account_balance_usd,
        profit_target_percent
      `
    )
    .eq("is_active", true)
    .order("price_usd", { ascending: true });

  if (error) {
    console.error("Failed to load subscription plans:", error);
  }

  const plans = (data ?? []) as SubscriptionPlan[];

  const planNames = ["beginner", "intermediate", "advanced"];

  return (
    <main className="subscriptions-page">
      <div className="market-grid" />
      <div className="market-glow market-glow-one" />
      <div className="market-glow market-glow-two" />

      <div className="page-shell">
        <header className="topbar">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark">T</span>

            <span className="brand-copy">
              <strong>TradeLogic</strong>
              <small>Automated Rule-Based Trading</small>
            </span>
          </Link>

          <Link href="/dashboard" className="dashboard-link">
            ← Dashboard
          </Link>
        </header>

        <section className="hero">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SUBSCRIPTION ACCESS
          </div>

          <h1>
            Choose the trading capacity
            <span> that fits your account.</span>
          </h1>

          <p>
            Select a monthly or quarterly TradeLogic subscription.
            Your subscription determines the account balance range
            available for an automated trading cycle.
          </p>
        </section>

        {error ? (
          <section className="error-panel">
            <strong>Subscription plans are temporarily unavailable.</strong>
            <span>
              Please return to your dashboard and try again shortly.
            </span>
          </section>
        ) : (
          <section className="plans-grid">
            {planNames.map((planName) => {
              const planOptions = plans.filter(
                (plan) => plan.name.toLowerCase() === planName
              );

              if (planOptions.length === 0) {
                return null;
              }

              const monthlyPlan = planOptions.find(
                (plan) => plan.billing_period === "monthly"
              );

              const quarterlyPlan = planOptions.find(
                (plan) => plan.billing_period === "quarterly"
              );

              const referencePlan =
                monthlyPlan ?? quarterlyPlan ?? planOptions[0];

              const quarterlySavings =
                monthlyPlan && quarterlyPlan
                  ? Number(monthlyPlan.price_usd) * 3 -
                    Number(quarterlyPlan.price_usd)
                  : 0;

              const minimumBalance = formatMoney(
                referencePlan.min_account_balance_usd
              );

              const maximumBalance = formatMoney(
                referencePlan.max_account_balance_usd
              );

              const isIntermediate = planName === "intermediate";

              return (
                <article
                  key={planName}
                  className={`plan-card ${
                    isIntermediate ? "featured-plan" : ""
                  }`}
                >
                  {isIntermediate && (
                    <div className="recommended">
                      POPULAR
                    </div>
                  )}

                  <div className="plan-heading">
                    <span className="plan-number">
                      {getPlanNumber(planName)}
                    </span>

                    <div>
                      <h2>{formatPlanName(planName)}</h2>
                      <p>{getPlanDescription(planName)}</p>
                    </div>
                  </div>

                  <div className="capital-section">
                    <span className="section-label">
                      TRADING ACCOUNT CAPACITY
                    </span>

                    {minimumBalance ? (
                      <div className="capital-range">
                        <strong>
                          {minimumBalance} – {maximumBalance}
                        </strong>
                        <span>USD-equivalent account balance</span>
                      </div>
                    ) : (
                      <div className="capital-range">
                        <strong>Up to {maximumBalance}</strong>
                        <span>No minimum account balance</span>
                      </div>
                    )}
                  </div>

                  <div className="cycle-target">
                    <span>Trading cycle target</span>

                    <strong>
                      {Number(
                        referencePlan.profit_target_percent
                      ).toFixed(0)}
                      %
                    </strong>
                  </div>

                  <div className="billing-options">
                    {monthlyPlan && (
                      <div className="billing-option">
                        <div className="billing-top">
                          <div>
                            <span className="billing-name">
                              Monthly
                            </span>

                            <span className="billing-duration">
                              {monthlyPlan.duration_months} month access
                            </span>
                          </div>

                          <div className="price">
                            <span>$</span>
                            <strong>
                              {Number(
                                monthlyPlan.price_usd
                              ).toFixed(0)}
                            </strong>
                          </div>
                        </div>

                        <Link
                          href={`/subscriptions/checkout?plan=${monthlyPlan.id}`}
                          className="select-button"
                        >
                          Select Monthly
                          <span>→</span>
                        </Link>
                      </div>
                    )}

                    {quarterlyPlan && (
                      <div className="billing-option quarterly-option">
                        <div className="billing-top">
                          <div>
                            <span className="billing-name">
                              Quarterly
                            </span>

                            <span className="billing-duration">
                              {quarterlyPlan.duration_months} months access
                            </span>
                          </div>

                          <div className="price">
                            <span>$</span>
                            <strong>
                              {Number(
                                quarterlyPlan.price_usd
                              ).toFixed(0)}
                            </strong>
                          </div>
                        </div>

                        {quarterlySavings > 0 && (
                          <div className="saving">
                            Save ${quarterlySavings.toFixed(0)}
                          </div>
                        )}

                        <Link
                          href={`/subscriptions/checkout?plan=${quarterlyPlan.id}`}
                          className="select-button gold-button"
                        >
                          Select Quarterly
                          <span>→</span>
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="notice">
          <div className="notice-icon">i</div>

          <div>
            <strong>Important trading-cycle information</strong>

            <p>
              Subscription access and trading-cycle completion are
              separate. When a paid trading cycle reaches its configured
              100% profit target, automated trading for that cycle stops
              even if subscription time remains. A new qualifying
              subscription starts a fresh trading cycle.
            </p>
          </div>
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

        .subscriptions-page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 15% 10%,
              rgba(11, 61, 46, 0.34),
              transparent 28%
            ),
            radial-gradient(
              circle at 88% 22%,
              rgba(7, 26, 47, 0.78),
              transparent 30%
            ),
            #06120f;
          color: #f7f7f2;
        }

        .market-grid {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.16;
          background-image:
            linear-gradient(
              rgba(212, 175, 55, 0.08) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(212, 175, 55, 0.08) 1px,
              transparent 1px
            );
          background-size: 55px 55px;
          mask-image:
            linear-gradient(
              to bottom,
              rgba(0, 0, 0, 0.8),
              transparent 85%
            );
          animation: gridMove 18s linear infinite;
        }

        .market-glow {
          position: fixed;
          width: 400px;
          height: 400px;
          border-radius: 999px;
          filter: blur(100px);
          pointer-events: none;
          opacity: 0.12;
        }

        .market-glow-one {
          top: 20%;
          left: -180px;
          background: #d4af37;
        }

        .market-glow-two {
          right: -170px;
          bottom: 10%;
          background: #228b22;
        }

        .page-shell {
          position: relative;
          z-index: 2;
          width: min(1280px, calc(100% - 40px));
          margin: 0 auto;
          padding-bottom: 45px;
        }

        .topbar {
          min-height: 92px;
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
          box-shadow: 0 0 30px rgba(212,175,55,0.08);
        }

        .brand-copy {
          display: flex;
          flex-direction: column;
        }

        .brand-copy strong {
          font-size: 17px;
          letter-spacing: 0.3px;
        }

        .brand-copy small {
          margin-top: 3px;
          color: #788781;
          font-size: 9px;
          letter-spacing: 1.4px;
          text-transform: uppercase;
        }

        .dashboard-link {
          color: #b7c1bc;
          text-decoration: none;
          font-size: 13px;
          transition: 160ms ease;
        }

        .dashboard-link:hover {
          color: #d4af37;
        }

        .hero {
          max-width: 820px;
          margin: 72px auto 55px;
          text-align: center;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 18px;
          color: #d4af37;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 2.4px;
        }

        .eyebrow-line {
          width: 26px;
          height: 1px;
          background: #d4af37;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(35px, 5vw, 58px);
          line-height: 1.04;
          letter-spacing: -2.2px;
        }

        .hero h1 span {
          color: #d4af37;
        }

        .hero p {
          max-width: 680px;
          margin: 22px auto 0;
          color: #94a19b;
          font-size: 14px;
          line-height: 1.8;
        }

        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          align-items: stretch;
        }

        .plan-card {
          position: relative;
          padding: 27px;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,0.09);
          background:
            linear-gradient(
              145deg,
              rgba(13,39,68,0.56),
              rgba(7,26,47,0.28)
            );
          box-shadow: 0 24px 70px rgba(0,0,0,0.18);
        }

        .featured-plan {
          border-color: rgba(212,175,55,0.36);
          box-shadow:
            0 24px 80px rgba(0,0,0,0.22),
            0 0 40px rgba(212,175,55,0.04);
        }

        .recommended {
          position: absolute;
          top: -11px;
          right: 22px;
          padding: 6px 12px;
          border-radius: 999px;
          background: #d4af37;
          color: #06120f;
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .plan-heading {
          display: flex;
          gap: 15px;
          min-height: 92px;
        }

        .plan-number {
          color: rgba(212,175,55,0.5);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
        }

        .plan-heading h2 {
          margin: 0 0 9px;
          font-size: 23px;
        }

        .plan-heading p {
          margin: 0;
          color: #7f8e87;
          font-size: 12px;
          line-height: 1.6;
        }

        .capital-section {
          margin-top: 21px;
          padding: 18px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(4,17,13,0.35);
        }

        .section-label {
          display: block;
          margin-bottom: 11px;
          color: #68766f;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 1.6px;
        }

        .capital-range {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .capital-range strong {
          color: #f2e8d5;
          font-size: 18px;
        }

        .capital-range span {
          color: #73817a;
          font-size: 10px;
        }

        .cycle-target {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 16px 2px 21px;
          color: #819088;
          font-size: 11px;
        }

        .cycle-target strong {
          color: #d4af37;
          font-size: 13px;
        }

        .billing-options {
          display: grid;
          gap: 12px;
        }

        .billing-option {
          position: relative;
          padding: 17px;
          border-radius: 15px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(6,18,15,0.42);
        }

        .quarterly-option {
          border-color: rgba(212,175,55,0.19);
        }

        .billing-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .billing-name {
          display: block;
          color: #e6e8e4;
          font-size: 13px;
          font-weight: 700;
        }

        .billing-duration {
          display: block;
          margin-top: 5px;
          color: #6e7c75;
          font-size: 9px;
        }

        .price {
          display: flex;
          align-items: flex-start;
          color: #f7f7f2;
        }

        .price span {
          margin-top: 4px;
          margin-right: 2px;
          color: #d4af37;
          font-size: 12px;
        }

        .price strong {
          font-size: 27px;
          line-height: 1;
        }

        .saving {
          display: inline-block;
          margin-top: 10px;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(34,197,94,0.09);
          color: #6edb92;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.4px;
        }

        .select-button {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-top: 15px;
          padding: 12px 13px;
          border-radius: 10px;
          border: 1px solid rgba(212,175,55,0.22);
          color: #d4af37;
          text-decoration: none;
          font-size: 11px;
          font-weight: 700;
          transition: 160ms ease;
        }

        .select-button:hover {
          transform: translateY(-1px);
          border-color: rgba(212,175,55,0.55);
          background: rgba(212,175,55,0.05);
        }

        .gold-button {
          background: #d4af37;
          color: #06120f;
        }

        .gold-button:hover {
          background: #e7c75c;
          color: #06120f;
        }

        .notice {
          display: flex;
          gap: 15px;
          max-width: 920px;
          margin: 32px auto 0;
          padding: 20px;
          border: 1px solid rgba(212,175,55,0.13);
          border-radius: 16px;
          background: rgba(212,175,55,0.025);
        }

        .notice-icon {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 27px;
          height: 27px;
          border-radius: 50%;
          border: 1px solid rgba(212,175,55,0.35);
          color: #d4af37;
          font-family: Georgia, serif;
          font-size: 13px;
        }

        .notice strong {
          color: #d6dbd7;
          font-size: 11px;
        }

        .notice p {
          margin: 7px 0 0;
          color: #76847d;
          font-size: 10px;
          line-height: 1.65;
        }

        .error-panel {
          max-width: 700px;
          margin: 0 auto;
          padding: 25px;
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 16px;
          background: rgba(239,68,68,0.05);
          text-align: center;
        }

        .error-panel strong,
        .error-panel span {
          display: block;
        }

        .error-panel span {
          margin-top: 7px;
          color: #8d9a94;
          font-size: 12px;
        }

        .footer {
          display: flex;
          justify-content: space-between;
          margin-top: 55px;
          padding-top: 22px;
          border-top: 1px solid rgba(255,255,255,0.06);
          color: #4f5d56;
          font-size: 9px;
          letter-spacing: 0.5px;
        }

        @keyframes gridMove {
          from {
            transform: translateY(0);
          }

          to {
            transform: translateY(55px);
          }
        }

        @media (max-width: 950px) {
          .plans-grid {
            grid-template-columns: 1fr;
            max-width: 620px;
            margin: 0 auto;
          }

          .plan-heading {
            min-height: auto;
          }
        }

        @media (max-width: 600px) {
          .page-shell {
            width: min(100% - 24px, 1280px);
          }

          .topbar {
            min-height: 76px;
          }

          .brand-copy small {
            display: none;
          }

          .hero {
            margin-top: 52px;
          }

          .hero h1 {
            letter-spacing: -1.4px;
          }

          .plan-card {
            padding: 20px;
          }

          .footer {
            gap: 15px;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}