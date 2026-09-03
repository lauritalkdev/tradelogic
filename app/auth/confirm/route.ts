import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";
import {
  getTradeLogicSender,
  mailTransporter,
} from "@/src/lib/email/mailer";
import { buildWelcomeEmail } from "@/src/lib/email/templates/welcome";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get(
    "type"
  ) as EmailOtpType | null;

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL(
        "/login?error=confirmation_failed",
        requestUrl.origin
      )
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error || !data.user) {
    return NextResponse.redirect(
      new URL(
        "/login?error=confirmation_failed",
        requestUrl.origin
      )
    );
  }

  const user = data.user;

  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";

  const displayName =
    fullName ||
    user.email?.split("@")[0] ||
    "Trader";

  if (user.email) {
    try {
      const welcomeEmail = buildWelcomeEmail({
        name: displayName,
      });

      await mailTransporter.sendMail({
        from: getTradeLogicSender(),
        to: user.email,
        subject: welcomeEmail.subject,
        text: welcomeEmail.text,
        html: welcomeEmail.html,
      });
    } catch (welcomeEmailError) {
      console.error(
        "TradeLogic welcome email failed:",
        welcomeEmailError
      );
    }
  }

  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL(
      "/login?confirmed=true",
      requestUrl.origin
    )
  );
}