import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CONTENT_PROMPTS = [
  "Create an educational post about a clinical assessment tool. Include a specific clinical statistic.",
  "Create a post showing time savings. Use concrete numbers contrasting before vs after.",
  "Create a post that connects with professional burnout and documentation frustration.",
  "Create a post showcasing a specific product feature with its clinical benefit.",
];

async function generateContent(brandName: string, prompt: string, needsSubtitle: boolean) {
  const subtitleField = needsSubtitle
    ? '  "subtitle": "short secondary phrase (max 10 words)",\n'
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
      system: `You are the social media manager for ${brandName}. Write in professional Spanish (Latin American). Be concise and clinical.`,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nRespond ONLY with valid JSON:\n{\n  "title": "short image text (max 6 words)",\n${subtitleField}  "caption": "full caption (max 280 chars)",\n  "hashtags": "#relevant #hashtags"\n}`,
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

export const maxDuration = 30;

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

  try {
    const content = await generateContent(brand.name, CONTENT_PROMPTS[idx], needsSubtitle);
    return NextResponse.json({
      title: content.title,
      subtitle: content.subtitle ?? null,
      caption: `${content.caption}\n\n${content.hashtags}`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
