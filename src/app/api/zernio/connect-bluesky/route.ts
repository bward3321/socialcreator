import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { connectBlueskyCredentials } from "@/lib/zernio/client";

const schema = z.object({
  identifier: z.string().min(1),
  appPassword: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAccess(user)) {
    return NextResponse.json({ error: "Trial expired" }, { status: 403 });
  }
  if (!user.zernioProfileKey) {
    return NextResponse.json({ error: "No Zernio profile" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { identifier, appPassword } = schema.parse(body);

    let normalized = identifier.trim().replace(/^@/, "");
    if (!normalized.includes(".")) normalized = `${normalized}.bsky.social`;
    console.log(`[connect-bluesky] user=${user.id} handle=${normalized}`);

    const result = await connectBlueskyCredentials(
      user.zernioProfileKey,
      normalized,
      appPassword
    );

    return NextResponse.json({ success: true, result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("[connect-bluesky] Error:", e);
    const message = e instanceof Error ? e.message : "Connect failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
