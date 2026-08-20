import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY,
    ALL: process.env
  });
}
