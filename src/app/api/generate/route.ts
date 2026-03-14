import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const CONTENT_PROMPTS = [
  "Create an educational post about a clinical assessment tool. Include a specific clinical statistic.",
  "Create a post showing time savings. Use concrete numbers contrasting before vs after.",
  "Create a post that connects with professional burnout and documentation frustration.",
  "Create a post showcasing a specific product feature with its clinical benefit.",
];

async function generateContent(
  brandName: string,
  prompt: string,
  needsSubtitle: boolean,
  usedTopics: string[]
) {
  const subtitleField = needsSubtitle
    ? '  "subtitle": "short secondary phrase (max 10 words)",\n'
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
      system: `You are the social media manager for ${brandName}. Write in professional Spanish (Latin American). Be concise and clinical.`,
      messages: [
        {
          role: "user",
          content: `${prompt}${topicsBlock}\n\nRespond ONLY with valid JSON:\n{\n  "title": "short image text (max 6 words)",\n${subtitleField}  "caption": "full caption (max 280 chars)",\n  "hashtags": "#relevant #hashtags",\n  "photo_query": "2-3 english keywords for a relevant background photo (professional, clinical, abstract)"\n}`,
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

async function searchUnsplash(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !query) return null;

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${key}` } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results ?? [];
    if (results.length === 0) return null;
    // Pick a random photo from top 5
    const photo = results[Math.floor(Math.random() * results.length)];
    return photo.urls?.regular ?? null;
  } catch {
    return null;
  }
}

async function getNextScheduledDate(
  preferredDays: number[],
  publishTime: string,
  timezone: string,
  brandId: string,
  supabase: any
): Promise<string> {
  const { data: existing } = await supabase
    .from("posts")
    .select("scheduled_at")
    .eq("brand_id", brandId)
    .not("scheduled_at", "is", null);

  const bookedDates = new Set(
    (existing ?? []).map((p: any) =>
      new Date(p.scheduled_at).toISOString().split("T")[0]
    )
  );

  const [hours, minutes] = publishTime.split(":").map(Number);
  const now = new Date();

  for (let offset = 0; offset < 56; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);

    const jsDay = candidate.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;

    if (!preferredDays.includes(isoDay)) continue;

    const dateStr = candidate.toISOString().split("T")[0];
    if (bookedDates.has(dateStr)) continue;

    const pad = (n: number) => String(n).padStart(2, "0");
    const localDatetime = `${dateStr}T${pad(hours)}:${pad(minutes)}:00`;

    const inTz = new Date(
      new Date(localDatetime).toLocaleString("en-US", { timeZone: timezone })
    );
    const utcDate = new Date(
      new Date(localDatetime).getTime() +
        (new Date(localDatetime).getTime() - inTz.getTime())
    );

    return utcDate.toISOString();
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split("T")[0];
  return new Date(`${dateStr}T${publishTime}:00Z`).toISOString();
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
    const content = await generateContent(brand.name, CONTENT_PROMPTS[idx], needsSubtitle, usedTopics);

    // Save the new topic for future deduplication
    const topic = content.title || content.caption?.slice(0, 60) || "";
    if (topic) {
      await supabase.from("post_topics").insert({ brand_id: brandId, topic });
    }

    // Search Unsplash for a background photo if the layout needs one
    let backgroundUrl: string | null = null;
    if (needsBackground && content.photo_query) {
      backgroundUrl = await searchUnsplash(content.photo_query);
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
