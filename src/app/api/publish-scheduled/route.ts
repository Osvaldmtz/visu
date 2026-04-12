import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Receiver } from "@upstash/qstash";

export const maxDuration = 30;

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(request: Request) {
  const bodyText = await request.text();
  const signature = request.headers.get("upstash-signature") ?? "";

  // Verify QStash signature using official SDK
  try {
    await receiver.verify({ signature, body: bodyText });
  } catch (e: any) {
    console.error("[publish-scheduled] Invalid signature:", e.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log("[publish-scheduled] Raw body:", JSON.stringify(bodyText), "length:", bodyText.length, "signature present:", !!signature);

  // QStash may base64-encode the body — try parsing directly, then try decoding
  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    try {
      parsed = JSON.parse(atob(bodyText));
    } catch {
      console.error("[publish-scheduled] Unparseable body:", bodyText.slice(0, 200));
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }

  const { postId, carouselId } = parsed;

  if (!postId && !carouselId) {
    return NextResponse.json({ error: "Missing postId or carouselId" }, { status: 400 });
  }

  // Use service role to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://visu-eight.vercel.app";
  const cronSecret = process.env.CRON_SECRET;

  // --- Carousel publish flow ---
  if (carouselId) {
    const { data: carousel } = await supabase
      .from("carousel_posts")
      .select("id, status")
      .eq("id", carouselId)
      .single();

    if (!carousel) {
      console.log("[publish-scheduled] Carousel not found:", carouselId);
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    if (carousel.status !== "SCHEDULED") {
      console.log("[publish-scheduled] Carousel not scheduled (status:", carousel.status, "), skipping:", carouselId);
      return NextResponse.json({ ok: true, skipped: true, reason: `Carousel status is ${carousel.status}` });
    }

    try {
      const res = await fetch(`${baseUrl}/api/publish-carousel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carouselId, apiKey: cronSecret }),
      });

      const data = await res.json();
      console.log("[publish-scheduled] Carousel publish result:", res.status, JSON.stringify(data).slice(0, 200));

      if (!res.ok) {
        return NextResponse.json({ error: data.error || "Carousel publish failed" }, { status: 502 });
      }

      await supabase
        .from("carousel_posts")
        .update({ qstash_message_id: null })
        .eq("id", carouselId);

      return NextResponse.json({ ok: true, published: true, type: "carousel" });
    } catch (e: any) {
      console.error("[publish-scheduled] Carousel error:", e.message);
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  // --- Single post publish flow ---
  // Verify post is still SCHEDULED (not cancelled or already published)
  const { data: post } = await supabase
    .from("posts")
    .select("id, status")
    .eq("id", postId)
    .single();

  if (!post) {
    console.log("[publish-scheduled] Post not found:", postId);
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.status !== "SCHEDULED") {
    console.log("[publish-scheduled] Post not scheduled (status:", post.status, "), skipping:", postId);
    return NextResponse.json({ ok: true, skipped: true, reason: `Post status is ${post.status}` });
  }

  try {
    const res = await fetch(`${baseUrl}/api/publish-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, apiKey: cronSecret }),
    });

    const data = await res.json();
    console.log("[publish-scheduled] Publish result:", res.status, JSON.stringify(data).slice(0, 200));

    if (!res.ok) {
      return NextResponse.json({ error: data.error || "Publish failed" }, { status: 502 });
    }

    // Clear the QStash message ID
    await supabase
      .from("posts")
      .update({ qstash_message_id: null })
      .eq("id", postId);

    return NextResponse.json({ ok: true, published: true });
  } catch (e: any) {
    console.error("[publish-scheduled] Error:", e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
