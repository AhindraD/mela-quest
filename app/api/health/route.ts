import { NextResponse } from "next/server";
import { buildHealthStatus } from "@/src/shared/health";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(buildHealthStatus(), { status: 200 });
}
