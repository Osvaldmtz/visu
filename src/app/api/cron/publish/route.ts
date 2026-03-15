import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find all SCHEDULED posts where scheduled_at <= now
  const now = new Date().toISOString();
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, scheduled_at")
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", now);

  if (error) {
    console.error("Cron query error:", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  if (!posts || posts.length === 0) {
    return NextResponse.json({ published: 0, message: "No posts due" });
  }

  const results = [];

  for (const post of posts) {
    try {
      // Call the publish endpoint internally
      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_SITE_URL || "https://visu-eight.vercel.app";

      const res = await fetch(`${baseUrl}/api/publish-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, apiKey: cronSecret }),
      });

      const data = await res.json();
      results.push({ id: post.id, status: res.ok ? "published" : "error", detail: data });
    } catch (e: any) {
      results.push({ id: post.id, status: "error", detail: e.message });
    }
  }

  return NextResponse.json({
    published: results.filter((r) => r.status === "published").length,
    total: posts.length,
    results,
  });
}
