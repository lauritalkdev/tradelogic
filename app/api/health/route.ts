import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("subscription_plans")
      .select("name, billing_period, price_usd")
      .eq("is_active", true)
      .order("price_usd", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          database: "connection_failed",
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      database: "connected",
      plansFound: data?.length ?? 0,
      plans: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        database: "connection_failed",
        error:
          error instanceof Error
            ? error.message
            : "Unknown server error",
      },
      { status: 500 }
    );
  }
}