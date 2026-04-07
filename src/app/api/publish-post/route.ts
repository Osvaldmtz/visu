import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { postId, apiKey, publishNow } = await request.json();

  const supabase = await createClient();
  const cronSecret = process.env.CRON_SECRET;

  if (apiKey && cronSecret && apiKey === cronSecret) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    return await publishPost(admin, postId, false);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return await publishPost(supabase, postId, !!publishNow);
}

async function publishPost(supabase: any, postId: string, immediate: boolean) {
  if (!postId) {
    return NextResponse.json({ error: "Missing postId" }, { status: 400 });
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("*, brands(*)")
    .eq("id", postId)
    .single();

  if (postError) {
    console.error("[publish-post] Post query error:", postError);
    return NextResponse.json({ error: `Post query failed: ${postError.message}` }, { status: 500 });
  }

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  if (!post.image_url) {
    return NextResponse.json({ error: "Post has no image. Generate or upload an image first." }, { status: 400 });
  }

  const brand = post.brands;
  if (!brand) {
    console.error("[publish-post] Brand join returned null for post:", postId);
    return NextResponse.json({ error: "Brand not found — unable to determine social accounts" }, { status: 500 });
  }

  // Get Postforme account IDs
  let igAccountId = process.env.POSTFORME_IG_ACCOUNT_ID ?? null;
  let fbAccountId = process.env.POSTFORME_FB_ACCOUNT_ID ?? null;

  // Check brand_social_accounts for non-Kalyo brands
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
    return NextResponse.json({ error: "No social accounts configured. Add Instagram or Facebook in Settings." }, { status: 400 });
  }

  const pfmApiKey = process.env.POSTFORME_API_KEY;
  if (!pfmApiKey) {
    return NextResponse.json({ error: "POSTFORME_API_KEY not configured on server" }, { status: 500 });
  }

  // Build Postforme API request body
  const body: any = {
    caption: post.caption || "",
    social_accounts: socialAccounts,
    media: [{ url: post.image_url }],
  };

  // If scheduled_at is in the future, include it (only for non-immediate publishes)
  if (!immediate && post.scheduled_at) {
    const scheduledDate = new Date(post.scheduled_at);
    if (scheduledDate > new Date()) {
      body.scheduled_at = scheduledDate.toISOString();
    }
  }

  try {
    console.log("[publish-post] Sending to Postforme:", JSON.stringify({ ...body, media: [`${post.image_url.slice(0, 80)}...`] }));

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
      console.error("[publish-post] Non-JSON response from Postforme:", res.status, responseText.slice(0, 500));
      return NextResponse.json({ error: `Postforme returned invalid response (${res.status})` }, { status: 502 });
    }

    console.log("[publish-post] Postforme response:", res.status, JSON.stringify(responseData).slice(0, 300));

    if (!res.ok) {
      const msg = responseData.message || responseData.error || `HTTP ${res.status}`;
      return NextResponse.json({ error: `Postforme: ${msg}` }, { status: 502 });
    }

    const { error: updateError } = await supabase
      .from("posts")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", postId);

    if (updateError) {
      console.error("[publish-post] DB update error:", updateError);
      return NextResponse.json({ error: `Published but failed to update status: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true, response: responseData });
  } catch (e: any) {
    console.error("[publish-post] Network error:", e.message);
    return NextResponse.json({ error: `Network error: ${e.message}` }, { status: 500 });
  }
}
