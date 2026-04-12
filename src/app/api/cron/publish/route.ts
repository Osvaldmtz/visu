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

  // Also find scheduled carousels
  const { data: carousels } = await supabase
    .from("carousel_posts")
    .select("id, scheduled_at")
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", now);

  const allDue = [
    ...(posts ?? []).map((p) => ({ ...p, _type: "post" as const })),
    ...(carousels ?? []).map((c) => ({ ...c, _type: "carousel" as const })),
  ];

  if (allDue.length === 0) {
    return NextResponse.json({ published: 0, message: "No posts due" });
  }

  const results = [];
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://visu-eight.vercel.app";

  for (const item of allDue) {
    try {
      const endpoint = item._type === "carousel" ? "publish-carousel" : "publish-post";
      const bodyKey = item._type === "carousel" ? "carouselId" : "postId";

      const res = await fetch(`${baseUrl}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [bodyKey]: item.id, apiKey: cronSecret }),
      });

      const data = await res.json();
      results.push({ id: item.id, type: item._type, status: res.ok ? "published" : "error", detail: data });
    } catch (e: any) {
      results.push({ id: item.id, type: item._type, status: "error", detail: e.message });
    }
  }

  return NextResponse.json({
    published: results.filter((r) => r.status === "published").length,
    total: allDue.length,
    results,
  });
}
