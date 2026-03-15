import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const SYSTEM_PROMPT = `Eres el social media manager de Kalyo, una plataforma SaaS para PSICÓLOGOS CLÍNICOS en Latinoamérica. Kalyo permite gestionar pacientes, aplicar tests psicológicos digitales (PHQ-9, GAD-7, Beck, Hamilton, etc), generar reportes con IA y administrar la consulta.

Audiencia: psicólogos clínicos 28-45 años, práctica privada o institucional en LATAM.

Tono: clínico-profesional, empático, directo. Español latinoamericano neutro. Sin emojis excesivos.

Temas válidos:
- Tests psicológicos y su interpretación (PHQ-9, GAD-7, Beck, Hamilton, MMPI, Rorschach, WAIS, etc)
- Documentación clínica y papeleo del psicólogo
- Burnout del psicólogo clínico
- Gestión de pacientes y citas
- Evaluación psicológica y psicodiagnóstico
- Features de Kalyo (reportes IA, tests digitales, expediente clínico)
- Salud mental, terapia, psicoterapia

Tagline: Evalúa más. Documenta menos. Trata mejor.

NUNCA generar contenido sobre: medicina física, signos vitales, hospitales, UCI, cardiología, cirugía, enfermería, o cualquier especialidad médica que no sea psicología clínica.`;

const CONTENT_PROMPTS = [
  "Crea un post educativo sobre un test psicológico específico (PHQ-9, GAD-7, Beck, Hamilton, etc). Incluye un dato clínico real sobre su uso o validez.",
  "Crea un post mostrando ahorro de tiempo para el psicólogo. Usa números concretos contrastando antes vs después de usar Kalyo para documentación o evaluación.",
  "Crea un post que conecte con el burnout del psicólogo clínico: exceso de papeleo, notas clínicas, reportes manuales, falta de tiempo para pacientes.",
  "Crea un post destacando una funcionalidad específica de Kalyo: tests digitales, reportes con IA, expediente clínico, o gestión de pacientes.",
];

async function generateContent(
  brandName: string,
  prompt: string,
  needsSubtitle: boolean,
  needsBackground: boolean,
  usedTopics: string[]
) {
  const subtitleField = needsSubtitle
    ? '  "subtitle": "short secondary phrase (max 10 words)",\n'
    : "";

  const bgField = needsBackground
    ? '  "bg_prompt": "short english visual description for an abstract background image related to the topic (e.g. soft purple gradient with bokeh lights, clinical workspace with warm lighting)"\n'
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
      system: SYSTEM_PROMPT,
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

async function generateFalBackground(bgPrompt: string, primaryColor: string): Promise<string | null> {
  const falKey = process.env.FAL_KEY;
  if (!falKey) return null;

  const prompt = `${bgPrompt}, ${primaryColor} purple tones, no text, no people, no objects, professional, clean background, high quality`;

  try {
    const res = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, image_size: "square_hd", num_images: 1 }),
    });
    const body = await res.json();
    if (!res.ok) {
      console.error("FAL queue error:", res.status, JSON.stringify(body));
      return null;
    }
    const { response_url } = body;

    // Poll for result
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, i < 3 ? 1000 : 2000));
      const poll = await fetch(response_url, {
        headers: { Authorization: `Key ${falKey}` },
      });
      const data = await poll.json();
      if (data.images) return data.images[0].url;
    }
    console.error("FAL polling timed out");
    return null;
  } catch (e: any) {
    console.error("FAL error:", e.message);
    return null;
  }
}

async function getNextScheduledDate(
  preferredDays: number[],
  publishTime: string,
  timezone: string,
  brandId: string,
  supabase: any
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
  const { brandId, layout } = await request.json();

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
    const content = await generateContent(
      brand.name,
      CONTENT_PROMPTS[idx],
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
      backgroundUrl = await generateFalBackground(
        content.bg_prompt,
        brand.primary_color ?? "#7C3DE3"
      );
    }

    const scheduledAt = getNextScheduledDate(
      brand.preferred_days ?? [1],
      brand.publish_time ?? "09:00",
      brand.timezone ?? "America/Mexico_City",
      brandId,
      supabase
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
