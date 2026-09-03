type WelcomeEmailInput = {
  name: string;
};

export function buildWelcomeEmail({
  name,
}: WelcomeEmailInput) {
  const safeName = name.trim() || "Trader";

  const subject = "Welcome to TradeLogic";

  const text = `
Welcome to TradeLogic, ${safeName}.

Your email address has been successfully confirmed and your TradeLogic account is now active.

You can now sign in to your dashboard and continue setting up your account.

Your next steps will include:
- Choosing a subscription plan
- Connecting your supported MT5 account
- Preparing your account for automated trading

For assistance, contact support@tradelogicbot.com.

TradeLogic
Automated Rule-Based Trading
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#04110D;
    font-family:Arial,Helvetica,sans-serif;
    color:#F7F7F2;
  "
>
  <table
    width="100%"
    cellpadding="0"
    cellspacing="0"
    role="presentation"
  >
    <tr>
      <td align="center" style="padding:40px 20px;">

        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          role="presentation"
          style="
            max-width:560px;
            background:#071A2F;
            border:1px solid rgba(212,175,55,0.25);
            border-radius:20px;
            overflow:hidden;
          "
        >
          <tr>
            <td
              align="center"
              style="padding:38px 30px 20px;"
            >
              <div
                style="
                  width:58px;
                  height:58px;
                  line-height:58px;
                  text-align:center;
                  border-radius:16px;
                  background:#0B3D2E;
                  border:1px solid #D4AF37;
                  color:#D4AF37;
                  font-size:23px;
                  font-weight:bold;
                "
              >
                T
              </div>

              <h1
                style="
                  margin:18px 0 5px;
                  font-size:28px;
                  color:#F7F7F2;
                "
              >
                TradeLogic
              </h1>

              <p
                style="
                  margin:0;
                  color:#D4AF37;
                  font-size:10px;
                  letter-spacing:2px;
                  text-transform:uppercase;
                "
              >
                Automated Rule-Based Trading
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:12px 36px 38px;">
              <h2
                style="
                  margin:0 0 16px;
                  font-size:22px;
                  color:#F7F7F2;
                "
              >
                Welcome, ${safeName}
              </h2>

              <p
                style="
                  margin:0 0 18px;
                  font-size:14px;
                  line-height:22px;
                  color:#C7CEC9;
                "
              >
                Your email address has been successfully
                confirmed and your TradeLogic account is
                now active.
              </p>

              <p
                style="
                  margin:0 0 22px;
                  font-size:14px;
                  line-height:22px;
                  color:#C7CEC9;
                "
              >
                You can now sign in to your dashboard and
                continue preparing your account for
                automated trading.
              </p>

              <div
                style="
                  padding:18px;
                  border-radius:14px;
                  background:rgba(212,175,55,0.05);
                  border:1px solid rgba(212,175,55,0.15);
                "
              >
                <p
                  style="
                    margin:0 0 12px;
                    color:#D4AF37;
                    font-size:12px;
                    font-weight:bold;
                  "
                >
                  Your next steps
                </p>

                <p
                  style="
                    margin:7px 0;
                    font-size:13px;
                    color:#C7CEC9;
                  "
                >
                  1. Choose your subscription plan
                </p>

                <p
                  style="
                    margin:7px 0;
                    font-size:13px;
                    color:#C7CEC9;
                  "
                >
                  2. Connect your supported MT5 account
                </p>

                <p
                  style="
                    margin:7px 0;
                    font-size:13px;
                    color:#C7CEC9;
                  "
                >
                  3. Prepare TradeLogic for automated trading
                </p>
              </div>

              <div
                style="
                  margin-top:26px;
                  padding:16px;
                  border-radius:12px;
                  background:rgba(255,255,255,0.035);
                  border:1px solid rgba(255,255,255,0.07);
                "
              >
                <p
                  style="
                    margin:0;
                    font-size:12px;
                    line-height:20px;
                    color:#83908A;
                  "
                >
                  Need assistance? Contact us at
                  support@tradelogicbot.com.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td
              align="center"
              style="
                border-top:1px solid rgba(255,255,255,0.08);
                padding:21px 30px;
              "
            >
              <p
                style="
                  margin:0 0 6px;
                  font-size:11px;
                  color:#77847E;
                "
              >
                TradeLogic
              </p>

              <p
                style="
                  margin:0;
                  font-size:10px;
                  color:#59655F;
                "
              >
                Secure automated trading access
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>
`.trim();

  return {
    subject,
    text,
    html,
  };
}