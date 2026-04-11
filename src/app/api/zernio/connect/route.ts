import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateConnectUrl } from "@/lib/zernio/client";
import { getAppUrl } from "@/lib/utils";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.zernioProfileKey) {
    return NextResponse.json({ error: "No Zernio profile" }, { status: 400 });
  }

  const { platform } = await req.json();
  if (!platform) {
    return NextResponse.json({ error: "Platform required" }, { status: 400 });
  }

  try {
    const result = await generateConnectUrl(
      platform,
      user.zernioProfileKey,
      `${getAppUrl()}/connect/callback?connected=true`
    );
    return NextResponse.json({ authUrl: result.authUrl });
  } catch (e) {
    console.error("Zernio connect error:", e);
    return NextResponse.json(
      { error: "Failed to generate connect URL" },
      { status: 500 }
    );
  }
}
