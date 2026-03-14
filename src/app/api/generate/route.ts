import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LAYOUT_NAMES = ["Overlay", "Split", "Minimal", "Foto"];

// Late API — server-side key, account IDs mapped per brand
async function getLateAccountIds(supabase: any, brandId: string, igHandle: string | null) {
  // Hardcoded mapping for Kalyo
  if (igHandle === "@kalyo_app" || igHandle === "kalyo_app") {
    return {
      ig: process.env.LATE_IG_ACCOUNT_ID ?? null,
      fb: process.env.LATE_FB_ACCOUNT_ID ?? null,
    };
  }
  // Look up from brand_social_accounts table
  const { data: accounts } = await supabase
    .from("brand_social_accounts")
    .select("platform, account_id")
    .eq("brand_id", brandId);

  const map: Record<string, string | null> = { ig: null, fb: null };
  for (const acc of accounts ?? []) {
    if (acc.platform === "instagram") map.ig = acc.account_id;
    if (acc.platform === "facebook") map.fb = acc.account_id;
  }
  return map;
}

function buildFalPrompts(primaryColor: string): (string | null)[] {
  return [
    `Pure deep ${primaryColor} gradient background, smooth bokeh light spots, no objects no people no text, minimal abstract`,
    `Soft ${primaryColor} gradient, subtle light leak, no objects no people no text, clean abstract`,
    null,
    null,
  ];
}

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

async function generateFalBackground(prompt: string): Promise<string | null> {
  try {
    const res = await fetch("https://queue.fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
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

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await fetch(response_url, {
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      });
      const data = await poll.json();
      if (data.images) return data.images[0].url;
    }
    console.error("FAL polling timed out after 60s");
    return null;
  } catch (e: any) {
    console.error("FAL error:", e.message);
    return null;
  }
}

async function renderImage(
  templateId: string,
  layers: Record<string, any>
): Promise<string> {
  const res = await fetch("https://api.templated.io/v1/render", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TEMPLATED_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ template: templateId, layers }),
  });
  const data = await res.json();
  if (!res.ok || !data.render_url) {
    console.error("Templated error:", res.status, JSON.stringify(data));
    throw new Error(`Templated render failed: ${data.error || res.status}`);
  }
  return data.render_url;
}

export async function POST(request: Request) {
  const { brandId, layout: singleLayout, replaceId } = await request.json();

  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (!brand) {
    console.error("Brand lookup failed:", { brandId, userId: user.id, error: brandError });
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const layouts = singleLayout !== undefined ? [singleLayout] : [0];
  const templateIds = [
    process.env.TEMPLATED_TEMPLATE_0!,
    process.env.TEMPLATED_TEMPLATE_1!,
    process.env.TEMPLATED_TEMPLATE_2!,
    process.env.TEMPLATED_TEMPLATE_3!,
  ];

  const results = [];

  for (const idx of layouts) {
    try {
      const content = await generateContent(
        brand.name,
        CONTENT_PROMPTS[idx],
        idx === 1 || idx === 2
      );

      const falPrompts = buildFalPrompts(brand.primary_color ?? "#7C3DE3");
      const falPrompt = falPrompts[idx];
      const bgUrl = falPrompt ? await generateFalBackground(falPrompt) : null;

      const fontFamily = brand.font_family ?? "Inter";
      const primaryColor = brand.primary_color ?? "#7C3DE3";

      const layers: Record<string, any> = {
        title: { text: content.title, font_family: fontFamily, color: primaryColor },
      };

      // Layouts 0,1 (dark bg) → light logo; Layouts 2,3 (light bg) → dark logo with fallback
      const logoUrl =
        idx <= 1
          ? brand.logo_light_url || brand.logo_url
          : brand.logo_dark_url || brand.logo_light_url || brand.logo_url;
      if (logoUrl) {
        layers.logo = { image_url: logoUrl };
      }
      if (content.subtitle) {
        layers.subtitle = { text: content.subtitle, font_family: fontFamily };
      }
      if (bgUrl) {
        layers.background = { image_url: bgUrl };
      }

      const imageUrl = await renderImage(templateIds[idx], layers);

      const postData = {
        brand_id: brandId,
        layout: idx,
        image_url: imageUrl,
        caption: `${content.caption}\n\n${content.hashtags}`,
        title: content.title,
        status: "DRAFT",
      };

      if (replaceId && layouts.length === 1) {
        await supabase.from("posts").update(postData).eq("id", replaceId);
      } else {
        await supabase.from("posts").insert(postData);
      }

      results.push({ layout: idx, status: "ok" });
    } catch (e: any) {
      results.push({ layout: idx, status: "error", message: e.message });
    }
  }

  return NextResponse.json({ results });
}
