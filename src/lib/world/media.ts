import sharp from "sharp";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export function imageSignature(
  bytes: Uint8Array,
): "jpeg" | "png" | "webp" | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
    return "png";
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return "webp";
  return null;
}
export async function sanitizeImage(bytes: Uint8Array) {
  if (bytes.length > MAX_IMAGE_BYTES || !imageSignature(bytes))
    throw new Error("Invalid image");
  const input = sharp(Buffer.from(bytes), {
    limitInputPixels: 24000000,
    failOn: "error",
    animated: true,
  });
  const metadata = await input.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    (metadata.pages ?? 1) > 1 ||
    !["jpeg", "png", "webp"].includes(metadata.format ?? "")
  )
    throw new Error("Invalid image");
  const { data, info } = await input
    .rotate()
    .resize({
      width: 1400,
      height: 1400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    bytes: data.length,
    mime: "image/webp" as const,
  };
}
