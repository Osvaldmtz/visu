import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { postId, apiKey } = await request.json();

  // Allow either authenticated user or cron secret
  const supabase = await createClient();
  const cronSecret = process.env.CRON_SECRET;

  if (apiKey && cronSecret && apiKey === cronSecret) {
    // Cron job auth — use service role for DB access
    const { createClient: createServiceClient } = await import("@supabase/supabase-js");
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    return await publishPost(admin, postId);
  }

  // User auth
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

  // Get Late account IDs
  let igAccountId = process.env.LATE_IG_ACCOUNT_ID ?? null;
  let fbAccountId = process.env.LATE_FB_ACCOUNT_ID ?? null;

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

  const lateApiKey = process.env.LATE_API_KEY;
  if (!lateApiKey) {
    return NextResponse.json({ error: "LATE_API_KEY not configured" }, { status: 500 });
  }

  // Call Late API
  const lateBody: any = {
    accounts,
    content: {
      body: post.caption || "",
      media: post.image_url ? [{ url: post.image_url }] : [],
    },
  };

  // If scheduled_at is in the future, send it to Late for scheduled publishing
  if (post.scheduled_at) {
    const scheduledDate = new Date(post.scheduled_at);
    if (scheduledDate > new Date()) {
      lateBody.scheduled_at = scheduledDate.toISOString();
    }
  }

  try {
    const res = await fetch("https://api.late.media/v1/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lateApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(lateBody),
    });

    const responseData = await res.json();

    if (!res.ok) {
      console.error("Late API error:", res.status, JSON.stringify(responseData));
      return NextResponse.json(
        { error: `Late API error: ${responseData.message || res.status}` },
        { status: 502 }
      );
    }

    // Update post status to PUBLISHED
    await supabase
      .from("posts")
      .update({
        status: "PUBLISHED",
        published_at: new Date().toISOString(),
      })
      .eq("id", postId);

    return NextResponse.json({ ok: true, lateResponse: responseData });
  } catch (e: any) {
    console.error("Late API call failed:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
