import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createMagicLinkToken } from "@/lib/auth";
import { sendMagicLinkEmail } from "@/lib/email";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = schema.parse(body);

    const token = await createMagicLinkToken(email);
    await sendMagicLinkEmail(email, token);

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    console.error("send-link error:", e);
    return NextResponse.json(
      { error: "Failed to send link" },
      { status: 500 }
    );
  }
}
