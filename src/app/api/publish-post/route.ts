import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { postId, apiKey } = await request.json();

  const supabase = await createClient();
  const cronSecret = process.env.CRON_SECRET;

  if (apiKey && cronSecret && apiKey === cronSecret) {
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    return await publishPost(admin, postId);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return await publishPost(supabase, postId);
}

async function publishPost(supabase: any, postId: string) {
  const { data: post } = await supabase
    .from("posts")
    .select("*, brands(*)")
    .eq("id", postId)
    .single();

  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const brand = post.brands;

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

  const accounts = [igAccountId, fbAccountId].filter(Boolean);
  if (accounts.length === 0) {
    return NextResponse.json({ error: "No social accounts configured" }, { status: 400 });
  }

  const apiKeyEnv = process.env.POSTFORME_API_KEY;
  if (!apiKeyEnv) {
    return NextResponse.json({ error: "POSTFORME_API_KEY not configured" }, { status: 500 });
  }

  const body: any = {
    accounts,
    content: {
      body: post.caption || "",
      media: post.image_url ? [{ url: post.image_url }] : [],
    },
  };

  if (post.scheduled_at) {
    const scheduledDate = new Date(post.scheduled_at);
    if (scheduledDate > new Date()) {
      body.scheduled_at = scheduledDate.toISOString();
    }
  }

  try {
    const res = await fetch("https://api.postforme.dev/v1/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKeyEnv}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseData = await res.json();

    if (!res.ok) {
      console.error("Postforme API error:", res.status, JSON.stringify(responseData));
      return NextResponse.json(
        { error: `Postforme API error: ${responseData.message || res.status}` },
        { status: 502 }
      );
    }

    await supabase
      .from("posts")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", postId);

    return NextResponse.json({ ok: true, response: responseData });
  } catch (e: any) {
    console.error("Postforme API call failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
