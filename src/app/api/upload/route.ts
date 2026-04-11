import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { uploadMediaToZernio } from "@/lib/zernio/client";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (Zernio limit)
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasAccess(user)) {
    return NextResponse.json({ error: "Trial expired" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not supported. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 25MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const publicUrl = await uploadMediaToZernio(arrayBuffer, file.type);

    return NextResponse.json({ url: publicUrl });
  } catch (e) {
    console.error("Upload error:", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
