import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { brandId, brandDescription, brandVoice } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("name, industry")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .single();

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const description = brandDescription || brand.industry || brand.name;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `Eres experto en social media marketing para negocios en LATAM. Una marca con esta descripción: "${description}"${brandVoice ? ` y este tono de voz: "${brandVoice}"` : ""} quiere crear contenido para Instagram y Facebook.

Sugiere en JSON:
{
  "suggested_topics": ["tema1", "tema2", ...15-20 temas específicos y accionables],
  "topics_to_avoid": ["evitar1", ...5-8 temas que deben evitarse],
  "reasoning": "explicación breve en español de por qué estos temas"
}

Responde SOLO en JSON, sin texto adicional.`,
        },
      ],
    }),
  });

  const data = await res.json();
  if (!data.content?.[0]?.text) {
    return NextResponse.json({ error: "AI response error" }, { status: 500 });
  }

  let raw = data.content[0].text.trim();
  if (raw.startsWith("```")) {
    const lines = raw.split("\n");
    raw = lines.slice(1).join("\n");
    if (raw.endsWith("```")) raw = raw.slice(0, -3).trim();
  }

  try {
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Failed to parse" }, { status: 500 });
  }
}
