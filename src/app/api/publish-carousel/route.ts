import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { carouselId, apiKey, publishNow } = await request.json();

  const supabase = await createClient();
  const cronSecret = process.env.CRON_SECRET;

  if (apiKey && cronSecret && apiKey === cronSecret) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    return await publishCarousel(admin, carouselId, false);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return await publishCarousel(supabase, carouselId, !!publishNow);
}

async function publishCarousel(supabase: any, carouselId: string, immediate: boolean) {
  if (!carouselId) {
    return NextResponse.json({ error: "Missing carouselId" }, { status: 400 });
  }

  const { data: carousel, error: queryError } = await supabase
    .from("carousel_posts")
    .select("*, brands(*)")
    .eq("id", carouselId)
    .single();

  if (queryError) {
    console.error("[publish-carousel] Query error:", queryError);
    return NextResponse.json({ error: `Query failed: ${queryError.message}` }, { status: 500 });
  }

  if (!carousel) return NextResponse.json({ error: "Carousel not found" }, { status: 404 });

  if (!carousel.image_urls?.length) {
    return NextResponse.json({ error: "Carousel has no images" }, { status: 400 });
  }

  const brand = carousel.brands;
  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 500 });
  }

  // Get Postforme account IDs
  let igAccountId = process.env.POSTFORME_IG_ACCOUNT_ID ?? null;
  let fbAccountId = process.env.POSTFORME_FB_ACCOUNT_ID ?? null;

  if (brand.ig_handle !== "@kalyo_app" && brand.ig_handle !== "kalyo_app") {
    const { data: accounts } = await supabase
      .from("brand_social_accounts")
      .select("platform, account_id")
      .eq("brand_id", brand.id);
    for (const acc of accounts ?? []) {
      if (acc.platform === "instagram") igAccountId = acc.account_id;
      if (acc.platform === "facebook") fbAccountId = acc.account_id;
    }
  }

  const socialAccounts = [igAccountId, fbAccountId].filter(Boolean) as string[];
  if (socialAccounts.length === 0) {
    return NextResponse.json({ error: "No social accounts configured" }, { status: 400 });
  }

  const pfmApiKey = process.env.POSTFORME_API_KEY;
  if (!pfmApiKey) {
    return NextResponse.json({ error: "POSTFORME_API_KEY not configured" }, { status: 500 });
  }

  const body: any = {
    caption: carousel.caption || "",
    social_accounts: socialAccounts,
    media: carousel.image_urls.map((url: string) => ({ url })),
  };

  if (!immediate && carousel.scheduled_at) {
    const scheduledDate = new Date(carousel.scheduled_at);
    if (scheduledDate > new Date()) {
      body.scheduled_at = scheduledDate.toISOString();
    }
  }

  try {
    console.log("[publish-carousel] Sending to Postforme:", JSON.stringify({
      ...body,
      media: body.media.map((m: any) => ({ url: m.url.slice(0, 60) + "..." })),
    }));

    const res = await fetch("https://api.postforme.dev/v1/social-posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pfmApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      console.error("[publish-carousel] Non-JSON response:", res.status, responseText.slice(0, 500));
      return NextResponse.json({ error: `Postforme returned invalid response (${res.status})` }, { status: 502 });
    }

    if (!res.ok) {
      const msg = responseData.message || responseData.error || `HTTP ${res.status}`;
      return NextResponse.json({ error: `Postforme: ${msg}` }, { status: 502 });
    }

    const { error: updateError } = await supabase
      .from("carousel_posts")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", carouselId);

    if (updateError) {
      console.error("[publish-carousel] DB update error:", updateError);
      return NextResponse.json({ error: `Published but status update failed: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, response: responseData });
  } catch (e: any) {
    console.error("[publish-carousel] Network error:", e.message);
    return NextResponse.json({ error: `Network error: ${e.message}` }, { status: 500 });
  }
}
