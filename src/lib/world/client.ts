import { supabase } from "@/lib/supabase";
export async function tokenHeaders() {
  const session = (await supabase()?.auth.getSession())?.data.session;
  return session
    ? { Authorization: `Bearer ${session.access_token}` }
    : { Authorization: "" };
}
export async function privateScope() {
  const session = (await supabase()?.auth.getSession())?.data.session;
  return session?.user.id ?? "guest";
}
export async function preparePhoto(file: File): Promise<string> {
  if (
    file.size > 4 * 1024 * 1024 ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type)
  )
    throw new Error("Invalid photo");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid =
    (bytes[0] === 255 && bytes[1] === 216) ||
    [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x) ||
    (new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP");
  if (!valid) throw new Error("Invalid image");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 24000000)
      throw new Error("Image too large");
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.82);
  } finally {
    bitmap.close();
  }
}
