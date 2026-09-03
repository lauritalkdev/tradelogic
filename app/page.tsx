import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing-page">
      <div className="market-background">
        <div className="market-grid" />

        <div className="chart chart-one">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="chart chart-two">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="glow glow-one" />
        <div className="glow glow-two" />
      </div>

      <header className="navbar">
        <Link href="/" className="brand">
          <div className="brand-mark">
            <span className="brand-line brand-line-one" />
            <span className="brand-line brand-line-two" />
            <span className="brand-line brand-line-three" />
          </div>

          <div className="brand-text">
            <strong>TradeLogic</strong>
            <small>RULE-BASED AUTOMATION</small>
          </div>
        </Link>

        <nav className="nav-actions">
          <Link href="/login" className="nav-login">
            Login
          </Link>

          <Link href="/register" className="nav-register">
            Get Started
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-content">
          <div className="status-pill">
            <span className="status-dot" />
            AUTOMATED RULE-BASED TRADING
          </div>

          <h1>
            Your Strategy Cannot Trade
            <span> While You Sleep.</span>
            <br />
            TradeLogic Can.
          </h1>

          <p className="hero-description">
            You may already have a strategy that works.
            The problem is that the market does not wait
            until you are watching.
          </p>

          <p className="hero-secondary">
            TradeLogic continuously watches the market and
            executes your predefined trading rules when the
            conditions are met — whether you are working,
            travelling, sleeping or away from your charts.
          </p>

          <div className="hero-actions">
            <Link href="/register" className="primary-button">
              Create Account
              <span>→</span>
            </Link>

            <Link href="/login" className="secondary-button">
              Returning User
            </Link>
          </div>

          <div className="trust-row">
            <div className="trust-item">
              <span className="trust-icon">✓</span>

              <div>
                <strong>Rule-Based</strong>
                <small>No emotional decisions</small>
              </div>
            </div>

            <div className="trust-divider" />

            <div className="trust-item">
              <span className="trust-icon">24</span>

              <div>
                <strong>Always Watching</strong>
                <small>Market monitoring</small>
              </div>
            </div>

            <div className="trust-divider" />

            <div className="trust-item">
              <span className="trust-icon">MT5</span>

              <div>
                <strong>Your Account</strong>
                <small>Your broker connection</small>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-terminal">
          <div className="terminal-card">
            <div className="terminal-top">
              <div>
                <small>TRADING ENGINE</small>
                <strong>TradeLogic Core</strong>
              </div>

              <div className="engine-status">
                <span />
                ACTIVE
              </div>
            </div>

            <div className="terminal-chart">
              <div className="chart-grid-lines" />

              <svg
                viewBox="0 0 500 210"
                preserveAspectRatio="none"
                className="price-line"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient
                    id="tradeLogicLine"
                    x1="0"
                    x2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#476b5f"
                    />

                    <stop
                      offset="50%"
                      stopColor="#d4af37"
                    />

                    <stop
                      offset="100%"
                      stopColor="#e7c75c"
                    />
                  </linearGradient>
                </defs>

                <path
                  d="
                    M0 160
                    C35 150 48 170 78 145
                    C105 122 125 150 153 114
                    C181 80 205 120 232 94
                    C260 68 275 82 302 55
                    C330 28 353 75 380 51
                    C410 25 430 44 500 16
                  "
                  fill="none"
                  stroke="url(#tradeLogicLine)"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />

                <path
                  d="
                    M0 160
                    C35 150 48 170 78 145
                    C105 122 125 150 153 114
                    C181 80 205 120 232 94
                    C260 68 275 82 302 55
                    C330 28 353 75 380 51
                    C410 25 430 44 500 16
                    L500 210
                    L0 210
                    Z
                  "
                  fill="url(#chartArea)"
                  opacity="0.07"
                />
              </svg>

              <div className="scan-line" />

              <div className="chart-marker marker-one">
                <span />
                RULE CHECK
              </div>

              <div className="chart-marker marker-two">
                <span />
                CONDITION MET
              </div>
            </div>

            <div className="terminal-stats">
              <div className="terminal-stat">
                <small>MARKET</small>
                <strong>XAUUSD</strong>
              </div>

              <div className="terminal-stat">
                <small>ENGINE</small>
                <strong className="active-text">
                  Monitoring
                </strong>
              </div>

              <div className="terminal-stat">
                <small>EXECUTION</small>
                <strong>Rule Based</strong>
              </div>
            </div>

            <div className="terminal-log">
              <div>
                <span className="log-time">02:14:08</span>
                <span>Scanning market conditions</span>
              </div>

              <div>
                <span className="log-time">02:14:09</span>
                <span>Strategy rules evaluated</span>
              </div>

              <div className="highlight-log">
                <span className="log-time">02:14:10</span>
                <span>Monitoring opportunity...</span>
              </div>
            </div>
          </div>

          <div className="floating-card floating-card-one">
            <span>01</span>

            <div>
              <small>DISCIPLINE</small>
              <strong>Rules over emotion</strong>
            </div>
          </div>

          <div className="floating-card floating-card-two">
            <span>24/7</span>

            <div>
              <small>AVAILABILITY</small>
              <strong>Never miss by absence</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="problem-section">
        <div className="section-heading">
          <small>WHY TRADELOGIC</small>

          <h2>
            The market does not care
            <br />
            whether you are available.
          </h2>
        </div>

        <div className="problem-grid">
          <article className="problem-card">
            <div className="card-number">01</div>

            <h3>You Have the Strategy</h3>

            <p>
              A trader can understand the setup perfectly
              and still miss it simply because they were
              not looking at the market when it appeared.
            </p>
          </article>

          <article className="problem-card featured-card">
            <div className="card-number">02</div>

            <h3>The Opportunity Appears</h3>

            <p>
              It may happen during a meeting, while
              travelling, at night or while your attention
              is somewhere completely different.
            </p>
          </article>

          <article className="problem-card">
            <div className="card-number">03</div>

            <h3>TradeLogic Stays Ready</h3>

            <p>
              Your coded rules can remain active, monitoring
              the market consistently and responding when
              your required conditions are present.
            </p>
          </article>
        </div>
      </section>

      <section className="logic-section">
        <div className="logic-panel">
          <div className="logic-copy">
            <small>FROM HUMAN RULES TO MACHINE DISCIPLINE</small>

            <h2>
              Your logic.
              <br />
              Executed consistently.
            </h2>

            <p>
              TradeLogic is not designed to guess the
              market. It is designed to follow defined
              trading instructions consistently, remove
              hesitation from execution and remain
              available when you cannot.
            </p>
          </div>

          <div className="logic-flow">
            <div className="flow-item">
              <span>1</span>

              <div>
                <small>MONITOR</small>
                <strong>Market conditions</strong>
              </div>
            </div>

            <div className="flow-line" />

            <div className="flow-item">
              <span>2</span>

              <div>
                <small>CHECK</small>
                <strong>Strategy rules</strong>
              </div>
            </div>

            <div className="flow-line" />

            <div className="flow-item">
              <span>3</span>

              <div>
                <small>EXECUTE</small>
                <strong>When conditions align</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-glow" />

        <small>TRADE WITH STRUCTURE</small>

        <h2>
          Stop depending on being
          <br />
          in front of the chart.
        </h2>

        <p>
          Build around rules, consistency and automated
          market monitoring.
        </p>

        <div className="cta-actions">
          <Link href="/register" className="primary-button">
            Start with TradeLogic
            <span>→</span>
          </Link>

          <Link href="/login" className="secondary-button">
            Login
          </Link>
        </div>
      </section>

      <footer className="footer">
        <Link href="/" className="footer-brand">
          TradeLogic
        </Link>

        <p>
          Rule-based automated trading infrastructure.
        </p>

        <div className="footer-links">
          <Link href="/login">Login</Link>
          <Link href="/register">Register</Link>
        </div>

        <small>
          Trading involves risk. Automated execution does
          not guarantee profits or eliminate the possibility
          of losses.
        </small>
      </footer>

      <style>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html) {
          scroll-behavior: smooth;
        }

        :global(body) {
          margin: 0;
          background: #06120f;
        }

        .landing-page {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 76% 19%,
              rgba(11, 61, 46, 0.24),
              transparent 27%
            ),
            radial-gradient(
              circle at 19% 48%,
              rgba(7, 26, 47, 0.27),
              transparent 32%
            ),
            #06120f;
          color: #f7f7f2;
        }

        .market-background {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }

        .market-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(
              rgba(255,255,255,0.025) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,0.025) 1px,
              transparent 1px
            );
          background-size: 72px 72px;
          mask-image:
            linear-gradient(
              to bottom,
              black,
              transparent 70%
            );
        }

        .glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(110px);
        }

        .glow-one {
          width: 320px;
          height: 320px;
          right: 6%;
          top: 10%;
          background: rgba(212,175,55,0.08);
        }

        .glow-two {
          width: 400px;
          height: 400px;
          left: -140px;
          top: 500px;
          background: rgba(11,61,46,0.12);
        }

        .chart {
          position: absolute;
          display: flex;
          align-items: end;
          gap: 16px;
          opacity: 0.07;
          transform: skewY(-6deg);
        }

        .chart span {
          display: block;
          width: 2px;
          background: #d4af37;
          animation:
            candleMove 5s ease-in-out infinite;
        }

        .chart-one {
          right: 6%;
          top: 120px;
        }

        .chart-two {
          left: 4%;
          top: 500px;
          opacity: 0.035;
        }

        .chart span:nth-child(1) {
          height: 38px;
        }

        .chart span:nth-child(2) {
          height: 70px;
          animation-delay: 0.3s;
        }

        .chart span:nth-child(3) {
          height: 52px;
          animation-delay: 0.7s;
        }

        .chart span:nth-child(4) {
          height: 108px;
          animation-delay: 1s;
        }

        .chart span:nth-child(5) {
          height: 86px;
          animation-delay: 1.4s;
        }

        .chart span:nth-child(6) {
          height: 132px;
          animation-delay: 1.8s;
        }

        .chart span:nth-child(7) {
          height: 96px;
          animation-delay: 2.2s;
        }

        .chart span:nth-child(8) {
          height: 152px;
          animation-delay: 2.6s;
        }

        .chart span:nth-child(9) {
          height: 122px;
          animation-delay: 3s;
        }

        .navbar {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 26px 0;
          border-bottom:
            1px solid rgba(255,255,255,0.055);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 11px;
          color: inherit;
          text-decoration: none;
        }

        .brand-mark {
          position: relative;
          width: 36px;
          height: 36px;
          border:
            1px solid rgba(212,175,55,0.35);
          border-radius: 10px;
          background:
            linear-gradient(
              145deg,
              rgba(212,175,55,0.09),
              rgba(11,61,46,0.08)
            );
          overflow: hidden;
        }

        .brand-line {
          position: absolute;
          width: 2px;
          background: #d4af37;
          transform: rotate(32deg);
        }

        .brand-line-one {
          height: 10px;
          left: 10px;
          top: 15px;
        }

        .brand-line-two {
          height: 18px;
          left: 17px;
          top: 9px;
        }

        .brand-line-three {
          height: 25px;
          left: 24px;
          top: 5px;
        }

        .brand-text strong {
          display: block;
          font-size: 16px;
          letter-spacing: -0.02em;
        }

        .brand-text small {
          display: block;
          margin-top: 3px;
          color: #7e8b84;
          font-size: 7px;
          letter-spacing: 0.17em;
        }

        .nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .nav-login,
        .nav-register {
          padding: 10px 15px;
          border-radius: 9px;
          text-decoration: none;
          font-size: 10px;
          font-weight: 700;
        }

        .nav-login {
          color: #d5ddd8;
        }

        .nav-register {
          border:
            1px solid rgba(212,175,55,0.4);
          background:
            rgba(212,175,55,0.08);
          color: #e7c75c;
        }

        .hero {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns:
            minmax(0, 1.03fr)
            minmax(380px, 0.97fr);
          gap: 80px;
          align-items: center;
          width: min(1180px, calc(100% - 40px));
          min-height: 680px;
          margin: 0 auto;
          padding: 72px 0 92px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border:
            1px solid rgba(212,175,55,0.14);
          border-radius: 999px;
          background:
            rgba(212,175,55,0.035);
          color: #b99d47;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow:
            0 0 10px rgba(34,197,94,0.55);
        }

        .hero h1 {
          max-width: 720px;
          margin: 22px 0 20px;
          font-size:
            clamp(42px, 5.4vw, 72px);
          line-height: 0.99;
          letter-spacing: -0.055em;
          font-weight: 680;
        }

        .hero h1 span {
          color: #d4af37;
        }

        .hero-description {
          max-width: 560px;
          margin: 0;
          color: #d6ddd9;
          font-size: 18px;
          line-height: 1.55;
        }

        .hero-secondary {
          max-width: 570px;
          margin: 14px 0 0;
          color: #87948d;
          font-size: 12px;
          line-height: 1.8;
        }

        .hero-actions,
        .cta-actions {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-top: 30px;
        }

        .primary-button,
        .secondary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          min-height: 48px;
          padding: 0 20px;
          border-radius: 11px;
          text-decoration: none;
          font-size: 11px;
          font-weight: 800;
          transition:
            transform 160ms ease,
            border-color 160ms ease,
            background 160ms ease;
        }

        .primary-button {
          background: #d4af37;
          color: #07120f;
          box-shadow:
            0 12px 35px rgba(212,175,55,0.1);
        }

        .primary-button:hover {
          transform: translateY(-2px);
        }

        .secondary-button {
          border:
            1px solid rgba(255,255,255,0.1);
          background:
            rgba(255,255,255,0.025);
          color: #d8dfdb;
        }

        .secondary-button:hover {
          border-color:
            rgba(212,175,55,0.28);
        }

        .trust-row {
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: 38px;
        }

        .trust-item {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .trust-icon {
          display: grid;
          place-items: center;
          min-width: 28px;
          height: 28px;
          padding: 0 5px;
          border-radius: 7px;
          border:
            1px solid rgba(212,175,55,0.16);
          color: #d4af37;
          font-size: 7px;
          font-weight: 800;
        }

        .trust-item strong,
        .trust-item small {
          display: block;
        }

        .trust-item strong {
          color: #bfc9c3;
          font-size: 8px;
        }

        .trust-item small {
          margin-top: 3px;
          color: #64736b;
          font-size: 7px;
        }

        .trust-divider {
          width: 1px;
          height: 25px;
          background:
            rgba(255,255,255,0.07);
        }

        .hero-terminal {
          position: relative;
        }

        .terminal-card {
          position: relative;
          padding: 20px;
          border:
            1px solid rgba(212,175,55,0.13);
          border-radius: 18px;
          background:
            linear-gradient(
              145deg,
              rgba(10,28,23,0.94),
              rgba(5,17,14,0.96)
            );
          box-shadow:
            0 40px 90px rgba(0,0,0,0.35);
          overflow: hidden;
        }

        .terminal-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(
              120deg,
              transparent,
              rgba(212,175,55,0.02),
              transparent
            );
          pointer-events: none;
        }

        .terminal-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 17px;
          border-bottom:
            1px solid rgba(255,255,255,0.055);
        }

        .terminal-top small,
        .terminal-top strong {
          display: block;
        }

        .terminal-top small {
          color: #64736b;
          font-size: 7px;
          letter-spacing: 0.14em;
        }

        .terminal-top strong {
          margin-top: 5px;
          font-size: 12px;
        }

        .engine-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #5db97c;
          font-size: 7px;
          font-weight: 700;
        }

        .engine-status span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #22c55e;
          animation:
            enginePulse 1.8s ease-in-out infinite;
        }

        .terminal-chart {
          position: relative;
          height: 270px;
          margin-top: 17px;
          overflow: hidden;
          border-radius: 12px;
          background:
            rgba(3,13,10,0.56);
        }

        .chart-grid-lines {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(
              rgba(255,255,255,0.035) 1px,
              transparent 1px
            ),
            linear-gradient(
              90deg,
              rgba(255,255,255,0.035) 1px,
              transparent 1px
            );
          background-size:
            100% 52px,
            68px 100%;
        }

        .price-line {
          position: absolute;
          inset: 25px 0 0;
          width: 100%;
          height: calc(100% - 35px);
          filter:
            drop-shadow(
              0 0 8px
              rgba(212,175,55,0.18)
            );
        }

        .scan-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background:
            linear-gradient(
              transparent,
              #d4af37,
              transparent
            );
          box-shadow:
            0 0 18px rgba(212,175,55,0.35);
          animation:
            scanMarket 5.5s linear infinite;
        }

        .chart-marker {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 7px;
          border-radius: 5px;
          background:
            rgba(6,18,15,0.93);
          border:
            1px solid rgba(212,175,55,0.11);
          color: #8f9b95;
          font-size: 6px;
        }

        .chart-marker span {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #d4af37;
        }

        .marker-one {
          left: 27%;
          bottom: 34%;
        }

        .marker-two {
          right: 11%;
          top: 24%;
          color: #d4af37;
        }

        .terminal-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          margin-top: 13px;
          border:
            1px solid rgba(255,255,255,0.05);
          border-radius: 10px;
        }

        .terminal-stat {
          padding: 12px;
        }

        .terminal-stat:not(:last-child) {
          border-right:
            1px solid rgba(255,255,255,0.05);
        }

        .terminal-stat small,
        .terminal-stat strong {
          display: block;
        }

        .terminal-stat small {
          color: #5d6b64;
          font-size: 6px;
          letter-spacing: 0.12em;
        }

        .terminal-stat strong {
          margin-top: 5px;
          color: #d5ddd8;
          font-size: 8px;
        }

        .terminal-stat .active-text {
          color: #5db97c;
        }

        .terminal-log {
          display: grid;
          gap: 8px;
          margin-top: 15px;
          padding: 12px;
          border-radius: 9px;
          background:
            rgba(0,0,0,0.14);
          color: #65736c;
          font-family:
            ui-monospace,
            SFMono-Regular,
            Menlo,
            monospace;
          font-size: 7px;
        }

        .terminal-log div {
          display: flex;
          gap: 12px;
        }

        .log-time {
          color: #43514a;
        }

        .highlight-log {
          color: #af9850;
        }

        .floating-card {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 11px 13px;
          border:
            1px solid rgba(212,175,55,0.13);
          border-radius: 10px;
          background:
            rgba(8,24,19,0.94);
          box-shadow:
            0 20px 40px rgba(0,0,0,0.25);
          animation:
            floatCard 5s ease-in-out infinite;
        }

        .floating-card > span {
          display: grid;
          place-items: center;
          min-width: 30px;
          height: 30px;
          border-radius: 8px;
          background:
            rgba(212,175,55,0.07);
          color: #d4af37;
          font-size: 8px;
          font-weight: 800;
        }

        .floating-card small,
        .floating-card strong {
          display: block;
        }

        .floating-card small {
          color: #5e6c65;
          font-size: 6px;
          letter-spacing: 0.12em;
        }

        .floating-card strong {
          margin-top: 4px;
          color: #c9d2cd;
          font-size: 7px;
        }

        .floating-card-one {
          left: -38px;
          bottom: 92px;
        }

        .floating-card-two {
          right: -36px;
          top: 80px;
          animation-delay: 1.8s;
        }

        .problem-section {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 100px 0;
          border-top:
            1px solid rgba(255,255,255,0.055);
        }

        .section-heading small,
        .logic-copy > small,
        .cta-section > small {
          color: #a58d43;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .section-heading h2,
        .logic-copy h2,
        .cta-section h2 {
          margin: 14px 0 0;
          font-size:
            clamp(32px, 4vw, 50px);
          line-height: 1.06;
          letter-spacing: -0.04em;
          font-weight: 620;
        }

        .problem-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 45px;
        }

        .problem-card {
          position: relative;
          min-height: 240px;
          padding: 26px;
          border:
            1px solid rgba(255,255,255,0.065);
          border-radius: 15px;
          background:
            rgba(8,25,20,0.42);
        }

        .featured-card {
          border-color:
            rgba(212,175,55,0.18);
          background:
            linear-gradient(
              150deg,
              rgba(212,175,55,0.045),
              rgba(8,25,20,0.5)
            );
        }

        .card-number {
          display: grid;
          place-items: center;
          width: 29px;
          height: 29px;
          border-radius: 7px;
          background:
            rgba(212,175,55,0.06);
          color: #b79b47;
          font-size: 7px;
        }

        .problem-card h3 {
          margin: 36px 0 10px;
          font-size: 17px;
          font-weight: 600;
        }

        .problem-card p {
          margin: 0;
          color: #78867f;
          font-size: 11px;
          line-height: 1.75;
        }

        .logic-section {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 10px 0 100px;
        }

        .logic-panel {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          align-items: center;
          padding: 55px;
          border:
            1px solid rgba(212,175,55,0.11);
          border-radius: 20px;
          background:
            linear-gradient(
              145deg,
              rgba(11,61,46,0.11),
              rgba(7,26,47,0.07)
            );
        }

        .logic-copy p {
          max-width: 500px;
          margin: 17px 0 0;
          color: #7f8d85;
          font-size: 11px;
          line-height: 1.8;
        }

        .logic-flow {
          display: grid;
          gap: 9px;
        }

        .flow-item {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          border:
            1px solid rgba(255,255,255,0.06);
          border-radius: 11px;
          background:
            rgba(3,15,12,0.34);
        }

        .flow-item > span {
          display: grid;
          place-items: center;
          width: 31px;
          height: 31px;
          border-radius: 8px;
          background:
            rgba(212,175,55,0.06);
          color: #d4af37;
          font-size: 8px;
          font-weight: 800;
        }

        .flow-item small,
        .flow-item strong {
          display: block;
        }

        .flow-item small {
          color: #66746d;
          font-size: 6px;
          letter-spacing: 0.14em;
        }

        .flow-item strong {
          margin-top: 4px;
          color: #cdd6d1;
          font-size: 10px;
        }

        .flow-line {
          width: 1px;
          height: 16px;
          margin-left: 31px;
          background:
            linear-gradient(
              #d4af37,
              rgba(212,175,55,0.05)
            );
        }

        .cta-section {
          position: relative;
          z-index: 2;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto 70px;
          padding: 90px 30px;
          overflow: hidden;
          border:
            1px solid rgba(212,175,55,0.13);
          border-radius: 22px;
          background:
            #081914;
          text-align: center;
        }

        .cta-glow {
          position: absolute;
          width: 400px;
          height: 240px;
          left: 50%;
          top: -150px;
          transform: translateX(-50%);
          border-radius: 50%;
          background:
            rgba(212,175,55,0.12);
          filter: blur(100px);
        }

        .cta-section p {
          margin: 16px auto 0;
          color: #7f8c85;
          font-size: 11px;
        }

        .cta-actions {
          justify-content: center;
        }

        .footer {
          position: relative;
          z-index: 2;
          display: grid;
          grid-template-columns:
            auto 1fr auto;
          gap: 30px;
          align-items: center;
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 30px 0 38px;
          border-top:
            1px solid rgba(255,255,255,0.055);
        }

        .footer-brand {
          color: #e4e9e6;
          font-size: 14px;
          font-weight: 800;
          text-decoration: none;
        }

        .footer p {
          margin: 0;
          color: #56645d;
          font-size: 8px;
        }

        .footer-links {
          display: flex;
          gap: 16px;
        }

        .footer-links a {
          color: #89958f;
          font-size: 8px;
          text-decoration: none;
        }

        .footer > small {
          grid-column: 1 / -1;
          color: #46534c;
          font-size: 7px;
          line-height: 1.6;
        }

        @keyframes scanMarket {
          from {
            left: -5%;
          }

          to {
            left: 105%;
          }
        }

        @keyframes enginePulse {
          0%,
          100% {
            opacity: 0.35;
            box-shadow:
              0 0 0 rgba(34,197,94,0);
          }

          50% {
            opacity: 1;
            box-shadow:
              0 0 12px rgba(34,197,94,0.55);
          }
        }

        @keyframes floatCard {
          0%,
          100% {
            transform: translateY(0);
          }

          50% {
            transform: translateY(-8px);
          }
        }

        @keyframes candleMove {
          0%,
          100% {
            transform: scaleY(0.85);
          }

          50% {
            transform: scaleY(1.12);
          }
        }

        @media (max-width: 980px) {
          .hero {
            grid-template-columns: 1fr;
            gap: 65px;
          }

          .hero-terminal {
            width: min(650px, 100%);
          }

          .floating-card-one {
            left: 15px;
          }

          .floating-card-two {
            right: 15px;
          }

          .problem-grid {
            grid-template-columns: 1fr;
          }

          .problem-card {
            min-height: auto;
          }

          .logic-panel {
            grid-template-columns: 1fr;
            gap: 45px;
            padding: 38px;
          }
        }

        @media (max-width: 680px) {
          .navbar {
            width: min(100% - 28px, 1180px);
            padding: 18px 0;
          }

          .brand-text small {
            display: none;
          }

          .nav-login {
            display: none;
          }

          .hero {
            width: min(100% - 28px, 1180px);
            min-height: auto;
            padding: 70px 0 80px;
          }

          .hero h1 {
            font-size: 43px;
          }

          .hero-description {
            font-size: 15px;
          }

          .hero-secondary {
            font-size: 11px;
          }

          .hero-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .primary-button,
          .secondary-button {
            width: 100%;
          }

          .trust-row {
            display: grid;
            grid-template-columns: 1fr;
          }

          .trust-divider {
            display: none;
          }

          .terminal-card {
            padding: 13px;
          }

          .terminal-chart {
            height: 220px;
          }

          .floating-card {
            display: none;
          }

          .problem-section,
          .logic-section,
          .cta-section,
          .footer {
            width: min(100% - 28px, 1180px);
          }

          .problem-section {
            padding: 80px 0;
          }

          .logic-panel {
            padding: 28px 20px;
          }

          .cta-section {
            padding: 70px 20px;
          }

          .cta-actions {
            flex-direction: column;
          }

          .footer {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .footer > small {
            grid-column: auto;
          }
        }
      `}</style>
    </main>
  );
}