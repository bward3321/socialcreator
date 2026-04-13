import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
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

    let processedBuffer: ArrayBuffer | Buffer = arrayBuffer;
    let processedName = file.name;
    let processedType = file.type;

    if (
      processedType.startsWith("image/") &&
      processedType !== "image/jpeg" &&
      processedType !== "image/png"
    ) {
      console.log(`[upload] Converting ${processedType} -> image/jpeg (${file.name})`);
      const converted = await sharp(Buffer.from(arrayBuffer))
        .jpeg({ quality: 90 })
        .toBuffer();
      processedBuffer = converted;
      processedName = file.name.replace(/\.(webp|gif|bmp|tiff|tif|avif|heic|heif)$/i, ".jpg");
      if (!/\.(jpg|jpeg)$/i.test(processedName)) processedName = `${processedName}.jpg`;
      processedType = "image/jpeg";
      console.log(`[upload] Converted. name=${processedName} bytes=${converted.byteLength}`);
    }

    const bufferForUpload =
      processedBuffer instanceof Buffer
        ? processedBuffer.buffer.slice(
            processedBuffer.byteOffset,
            processedBuffer.byteOffset + processedBuffer.byteLength
          )
        : processedBuffer;

    const publicUrl = await uploadMediaToZernio(
      bufferForUpload as ArrayBuffer,
      processedName,
      processedType
    );
    console.log(`[upload] Done. url=${publicUrl}`);

    return NextResponse.json({
      url: publicUrl,
      mimeType: processedType,
      type: isVideo ? "video" : "image",
    });
  } catch (e) {
    console.error("[upload] Error:", e);
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
