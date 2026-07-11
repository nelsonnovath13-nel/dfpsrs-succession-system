import { NextResponse } from "next/server";
import { getRegions } from "tz-locations";

export async function GET() {
  return NextResponse.json({ regions: getRegions() });
}
