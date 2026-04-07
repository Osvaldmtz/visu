import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_CONTENT_PROMPTS = [
  "Crea un post educativo sobre un tema relevante para la audiencia de la marca. Incluye un dato o estadística real.",
  "Crea un post mostrando ahorro de tiempo o eficiencia. Usa números concretos contrastando antes vs después.",
  "Crea un post que conecte emocionalmente con los problemas diarios de la audiencia.",
  "Crea un post destacando una funcionalidad o beneficio específico del producto/servicio.",
];

function buildSystemPrompt(brand: any): string {
  const description = brand.brand_description || `${brand.name} — ${brand.industry || "negocio"}`;
  const voice = brand.brand_voice || "Profesional, empático, directo. Español latinoamericano neutro.";
  const topics = brand.content_topics
    ? `\n\nTemas válidos:\n${brand.content_topics.split("\n").map((t: string) => `- ${t.trim()}`).filter((t: string) => t !== "- ").join("\n")}`
    : "";
  const avoid = brand.topics_to_avoid
    ? `\n\nNUNCA generar contenido sobre:\n${brand.topics_to_avoid.split("\n").map((t: string) => `- ${t.trim()}`).filter((t: string) => t !== "- ").join("\n")}`
    : "";

  return `Eres el social media manager de ${brand.name}. ${description}

Tono: ${voice}${topics}${avoid}

Escribe en español latinoamericano. Sé conciso y relevante para la audiencia de la marca.`;
}

async function generateContent(
  systemPrompt: string,
  prompt: string,
  needsSubtitle: boolean,
  needsBackground: boolean,
  usedTopics: string[]
) {
  const subtitleField = needsSubtitle
    ? '  "subtitle": "short secondary phrase (max 10 words)",\n'
    : "";

  const bgField = needsBackground
    ? `  "bg_prompt": "3-5 word image description in english that visually represents the post topic. The image should relate to the title and caption you generated. Keep it abstract/conceptual, professional, no text, no people. Example: warm cozy office desk, golden sunset mountain landscape, colorful data visualization abstract."\n`
    : "";

  const topicsBlock =
    usedTopics.length > 0
      ? `\n\nTEMAS YA USADOS (no repetir, genera un tema completamente diferente):\n- ${usedTopics.join("\n- ")}`
      : "";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `${prompt}${topicsBlock}\n\nRespond ONLY with valid JSON:\n{\n  "title": "short image text (max 6 words)",\n${subtitleField}  "caption": "full caption (max 280 chars)",\n  "hashtags": "#relevant #hashtags",\n${bgField}}`,
        },
      ],
    }),
  });

  const data = await res.json();
  if (!data.content?.[0]?.text) {
    console.error("Anthropic response missing content:", JSON.stringify(data));
    throw new Error("Empty response from Anthropic");
  }
  let raw = data.content[0].text.trim();
  if (raw.startsWith("```")) {
    const lines = raw.split("\n");
    raw = lines.slice(1).join("\n");
    if (raw.endsWith("```")) raw = raw.slice(0, -3).trim();
  }
  return JSON.parse(raw);
}

async function generateGeminiBackground(bgPrompt: string, primaryColor: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const prompt = `Generate a background image: ${bgPrompt}, ${primaryColor} purple tones, no text, no people, no objects, professional, clean background, high quality, square format`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
            responseMimeType: "text/plain",
          },
        }),
      }
    );

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Gemini image error:", res.status, errBody);
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    if (!parts) return null;

    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart) return null;

    // Return as data URL — the template editor and approve-post flow accept this
    const { mimeType, data: b64 } = imagePart.inlineData;
    return `data:${mimeType};base64,${b64}`;
  } catch (e: any) {
    console.error("Gemini image error:", e.message);
    return null;
  }
}

async function getNextScheduledDate(
  preferredDays: number[],
  publishTime: string,
  timezone: string,
  brandId: string,
  supabase: any,
  extraExcludeDates: string[] = []
): Promise<string | null> {
  // Validate inputs
  const days = Array.isArray(preferredDays) && preferredDays.length > 0 ? preferredDays : [1];
  // Normalize publish_time — handle "09:00", "09:00:00", or null
  const timeParts = (publishTime || "09:00").split(":");
  const hours = parseInt(timeParts[0], 10) || 9;
  const minutes = parseInt(timeParts[1], 10) || 0;

  const { data: existing } = await supabase
    .from("posts")
    .select("scheduled_at")
    .eq("brand_id", brandId)
    .not("scheduled_at", "is", null);

  const bookedDates = new Set<string>();
  for (const p of existing ?? []) {
    try {
      bookedDates.add(new Date(p.scheduled_at).toISOString().split("T")[0]);
    } catch { /* skip invalid dates */ }
  }
  // Add dates already claimed by the current batch
  for (const d of extraExcludeDates) {
    try {
      bookedDates.add(new Date(d).toISOString().split("T")[0]);
    } catch { /* skip */ }
  }

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");

  for (let offset = 0; offset < 56; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);

    // JS getDay(): 0=Sun → we use ISO 1=Mon..7=Sun
    const jsDay = candidate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (!days.includes(isoDay)) continue;

    const dateStr = candidate.toISOString().split("T")[0];
    if (bookedDates.has(dateStr)) continue;

    // Build UTC datetime — use UTC directly (simple, reliable)
    const utcStr = `${dateStr}T${pad(hours)}:${pad(minutes)}:00Z`;
    return utcStr;
  }

  // Fallback: tomorrow at publish time
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];
  return `${dateStr}T${pad(hours)}:${pad(minutes)}:00Z`;
}

export const maxDuration = 60;

export async function POST(request: Request) {
  const { brandId, layout, excludeDates, customTopic } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const idx = layout ?? 0;
  const needsSubtitle = idx === 1 || idx === 2;
  const needsBackground = idx === 0 || idx === 1 || idx === 3;

  // Fetch last 20 used topics to avoid repetition
  const { data: topicRows } = await supabase
    .from("post_topics")
    .select("topic")
    .eq("brand_id", brandId)
    .order("used_at", { ascending: false })
    .limit(20);

  const usedTopics = (topicRows ?? []).map((r: any) => r.topic);

  try {
    const systemPrompt = brand.brand_skill?.trim() || buildSystemPrompt(brand);
    const prompt = customTopic
      ? `Crea un post para ${brand.name} sobre el tema: "${customTopic}". El post debe ser relevante y atractivo para la audiencia de la marca.`
      : DEFAULT_CONTENT_PROMPTS[idx];
    const content = await generateContent(
      systemPrompt,
      prompt,
      needsSubtitle,
      needsBackground,
      usedTopics
    );

    // Save the new topic for future deduplication
    const topic = content.title || content.caption?.slice(0, 60) || "";
    if (topic) {
      await supabase.from("post_topics").insert({ brand_id: brandId, topic });
    }

    // Generate background image with FAL.ai for layouts 0, 1, 3
    let backgroundUrl: string | null = null;
    if (needsBackground && content.bg_prompt) {
      backgroundUrl = await generateGeminiBackground(
        content.bg_prompt,
        brand.primary_color ?? "#7C3DE3"
      );
    }

    const scheduledAt = getNextScheduledDate(
      brand.preferred_days ?? [1],
      brand.publish_time ?? "09:00",
      brand.timezone ?? "America/Mexico_City",
      brandId,
      supabase,
      excludeDates ?? []
    );

    return NextResponse.json({
      title: content.title,
      subtitle: content.subtitle ?? null,
      caption: `${content.caption}\n\n${content.hashtags}`,
      scheduled_at: await scheduledAt,
      backgroundUrl,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
