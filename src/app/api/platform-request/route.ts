import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform } = await req.json();
  if (!platform || typeof platform !== "string") {
    return NextResponse.json({ error: "Platform name required" }, { status: 400 });
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "Pulsr <hello@pulsr.app>",
      to: "brendan@growtoro.com",
      subject: `Pulsr Platform Request: ${platform}`,
      html: `
        <p><strong>Platform requested:</strong> ${platform}</p>
        <p><strong>Requested by:</strong> ${user.email}</p>
      `,
    });
  } catch (e) {
    console.error("Platform request email error:", e);
  }

  return NextResponse.json({ ok: true });
}
