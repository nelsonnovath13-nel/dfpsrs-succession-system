import { NextRequest, NextResponse } from "next/server";
import { getWardsByDistrict } from "tz-locations";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  const district = req.nextUrl.searchParams.get("district");
  if (!region || !district) return NextResponse.json({ wards: [] });
  return NextResponse.json({ wards: getWardsByDistrict(region, district) });
}
