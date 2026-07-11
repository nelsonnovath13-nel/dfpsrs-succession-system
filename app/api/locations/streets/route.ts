import { NextRequest, NextResponse } from "next/server";
import { getStreets } from "tz-locations";

export async function GET(req: NextRequest) {
  const region = req.nextUrl.searchParams.get("region");
  const district = req.nextUrl.searchParams.get("district");
  const ward = req.nextUrl.searchParams.get("ward");
  if (!region || !district || !ward) return NextResponse.json({ streets: [] });
  return NextResponse.json({ streets: getStreets(region, district, ward) });
}
