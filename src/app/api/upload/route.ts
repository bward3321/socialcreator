import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasAccess } from "@/lib/auth";
import { uploadMediaToZernio } from "@/lib/zernio/client";

const MAX_IMAGE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

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
      console.error("[upload] No file in FormData");
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log(`[upload] Received file name=${file.name} type=${file.type} size=${file.size}`);

    if (!ALLOWED_TYPES.includes(file.type)) {
      console.error(`[upload] Rejected MIME: ${file.type}`);
      return NextResponse.json(
        { error: `File type not supported. Allowed: ${ALLOWED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    const isVideo = file.type.startsWith("video/");
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `File too large. Maximum ${isVideo ? "500MB" : "25MB"}.` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const publicUrl = await uploadMediaToZernio(arrayBuffer, file.name, file.type);
    console.log(`[upload] Done. url=${publicUrl}`);

    return NextResponse.json({
      url: publicUrl,
      mimeType: file.type,
      type: isVideo ? "video" : "image",
    });
  } catch (e) {
    console.error("[upload] Error:", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
