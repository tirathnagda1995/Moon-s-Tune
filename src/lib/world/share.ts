import { dailyPrompt } from "./domain";
import { cityById } from "./cities";
import { brand } from "./brand";
import type { WorldMessages } from "./i18n";
export interface ShareSpec {
  kind: "world" | "city" | "prompt" | "same";
  cityId?: string;
  preview: boolean;
}
// Accepts only public identifiers. There is deliberately no notes/health/signals argument.
export function shareModel(
  spec: ShareSpec,
  m: WorldMessages,
  now = new Date(),
) {
  const city = spec.cityId ? cityById(spec.cityId) : undefined;
  return {
    brand: brand.name,
    title:
      spec.kind === "city" && city
        ? city.name
        : spec.kind === "world"
          ? m.title
          : spec.kind === "same"
            ? m.sameTitle
            : m.promptTitle,
    body: spec.kind === "world" ? m.intro : dailyPrompt(now).text,
    disclosure: spec.preview ? m.preview : m.live,
    date: now.toISOString().slice(0, 10),
    path: city
      ? `/city/${city.id}${spec.preview ? "?mode=preview" : ""}`
      : `/${spec.preview ? "?mode=preview" : ""}`,
  };
}
export async function renderShareCard(
  spec: ShareSpec,
  m: WorldMessages,
): Promise<Blob> {
  const model = shareModel(spec, m);
  return drawShareCard(model);
}
export async function renderPersonalShare(
  summary: string,
  consent: boolean,
  m: WorldMessages,
): Promise<Blob> {
  if (!consent || !summary.trim() || summary.length > 500)
    throw new Error("Explicit consent and a bounded summary required");
  return drawShareCard({
    brand: brand.name,
    title: m.personalInsight,
    body: summary,
    disclosure: m.personalInsightDisclosure,
    date: "",
  });
}
async function drawShareCard(model: {
  brand: string;
  title: string;
  body: string;
  disclosure: string;
  date: string;
}): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#eeeade";
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = "#c4d5bb";
  ctx.beginPath();
  ctx.arc(800, 560, 480, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7d91784d";
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.ellipse(530, 500, 480, 60 + i * 42, -0.25, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#243328";
  ctx.font = "28px sans-serif";
  ctx.fillText(model.brand.toUpperCase(), 80, 115);
  ctx.font = "22px sans-serif";
  ctx.fillText(model.disclosure.toUpperCase(), 80, 1080, 920);
  let y = 1190;
  ctx.font = "76px Georgia";
  const wrap = (text: string, width: number, lineHeight: number) => {
    let line = "";
    for (const word of text.split(" ")) {
      if (ctx.measureText(line + word).width > width && line) {
        ctx.fillText(line, 80, y);
        y += lineHeight;
        line = "";
      }
      line += word + " ";
    }
    ctx.fillText(line, 80, y);
    y += lineHeight;
  };
  wrap(model.title, 900, 91);
  y += 35;
  ctx.font = model.body.length > 220 ? "28px sans-serif" : "36px sans-serif";
  wrap(model.body, 900, model.body.length > 220 ? 42 : 55);
  ctx.font = "25px sans-serif";
  ctx.fillText(model.date, 80, 1800);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      "image/png",
    ),
  );
}
