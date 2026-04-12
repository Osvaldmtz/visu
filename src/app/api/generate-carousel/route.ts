import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120;

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

async function generateGeminiBackground(
  bgPrompt: string,
  primaryColor: string,
  format: string
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return null;

  const formatDesc =
    format === "story"
      ? "vertical 9:16 story format"
      : format === "portrait"
      ? "portrait 4:5 vertical format"
      : "square format";

  const prompt = `Generate a background image: ${bgPrompt}, ${primaryColor} purple tones, no text, no people, no objects, professional, clean background, high quality, ${formatDesc}`;

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
      console.error("Gemini image error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const parts = data.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: any) => p.inlineData);
    if (!imagePart) return null;

    const { mimeType, data: b64 } = imagePart.inlineData;
    return `data:${mimeType};base64,${b64}`;
  } catch (e: any) {
    console.error("Gemini image error:", e.message);
    return null;
  }
}

export async function POST(request: Request) {
  const { brandId, topic, slideCount, layout, format, generateImages } =
    await request.json();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (!brand)
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const count = Math.max(2, Math.min(10, slideCount || 5));
  const systemPrompt = brand.brand_skill?.trim() || buildSystemPrompt(brand);

  // --- Step 1: Generate all slide content + caption with Claude ---
  try {
    const userPrompt = `Crea un carrusel de ${count} slides para Instagram/Facebook sobre el tema: "${topic}".

El carrusel debe contar una historia coherente dividida en ${count} partes. Cada slide debe poder entenderse por sí sola pero fluir como una narrativa.

Responde SOLO con JSON válido con esta estructura:
{
  "caption": "caption completo para el post (max 300 chars, incluye hashtags relevantes)",
  "slides": [
    {
      "title": "titulo corto para la imagen (max 6 palabras)",
      "subtitle": "frase secundaria (max 10 palabras)",
      "body_text": "parrafo explicativo de 1-2 oraciones cortas",
      "bg_prompt": "3-5 words in english describing an abstract background image for this slide topic. No text, no people. Example: warm sunset gradient, digital network connections"
    }
  ]
}

Slide 1 debe ser un gancho/hook que atrape la atención.
Los slides intermedios desarrollan el tema con datos o consejos concretos.
El último slide debe ser un call-to-action o conclusión fuerte.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await res.json();
    if (!data.content?.[0]?.text) {
      console.error("Anthropic response:", JSON.stringify(data));
      throw new Error("Empty response from Claude");
    }

    let raw = data.content[0].text.trim();
    if (raw.startsWith("```")) {
      const lines = raw.split("\n");
      raw = lines.slice(1).join("\n");
      if (raw.endsWith("```")) raw = raw.slice(0, -3).trim();
    }

    const content = JSON.parse(raw);

    if (!content.slides || !Array.isArray(content.slides)) {
      throw new Error("Invalid response: missing slides array");
    }

    // --- Step 2: Generate background images with Gemini (if requested) ---
    const primaryColor = brand.primary_color ?? "#7C3DE3";
    const slideFormat = format || "square";

    if (generateImages !== false) {
      // Generate images sequentially to avoid rate limits
      for (let i = 0; i < content.slides.length; i++) {
        const slide = content.slides[i];
        if (slide.bg_prompt) {
          const bgUrl = await generateGeminiBackground(
            slide.bg_prompt,
            primaryColor,
            slideFormat
          );
          content.slides[i].background_url = bgUrl || "";
        }
      }
    }

    // Save topic for deduplication
    await supabase
      .from("post_topics")
      .insert({ brand_id: brandId, topic });

    return NextResponse.json({
      caption: content.caption || "",
      slides: content.slides.map((s: any) => ({
        title: s.title || "",
        subtitle: s.subtitle || "",
        body_text: s.body_text || "",
        background_url: s.background_url || "",
        bg_prompt: s.bg_prompt || "",
      })),
    });
  } catch (e: any) {
    console.error("Generate carousel error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
