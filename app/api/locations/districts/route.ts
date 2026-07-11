import { NextRequest, NextResponse } from "next/server";
import { getDistrictsByRegion } from "tz-locations";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  if (!region) return NextResponse.json({ districts: [] });
  return NextResponse.json({ districts: getDistrictsByRegion(region) });
}
