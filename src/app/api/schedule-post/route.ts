import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { postId, scheduledAt, caption, title } = await request.json();

  if (!postId || !scheduledAt) {
    return NextResponse.json({ error: "Missing postId or scheduledAt" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Calculate delay in seconds
  const targetDate = new Date(scheduledAt);
  const now = new Date();
  const delaySecs = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / 1000));

  if (delaySecs <= 0) {
    return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";

  // Use the stable production domain — VERCEL_URL is deployment-specific and ephemeral
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://visu-eight.vercel.app";
  const callbackUrl = `${baseUrl}/api/publish-scheduled`;

  let qstashMessageId: string | null = null;

  if (qstashToken) {
    try {
      const res = await fetch(`${qstashUrl}/v2/publish/${callbackUrl}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
          "Upstash-Delay": `${delaySecs}s`,
        },
        body: JSON.stringify({ postId }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[schedule-post] QStash error:", res.status, errBody);
        // Fall through — still save to DB so cron fallback works
      } else {
        const data = await res.json();
        qstashMessageId = data.messageId ?? null;
        console.log("[schedule-post] QStash scheduled:", qstashMessageId, `delay=${delaySecs}s`);
      }
    } catch (e: any) {
      console.error("[schedule-post] QStash error:", e.message);
    }
  }

  // Update post in DB (always, even if QStash fails — cron is fallback)
  const updateData: Record<string, any> = {
    status: "SCHEDULED",
    scheduled_at: scheduledAt,
    caption: caption ?? undefined,
    title: title ?? undefined,
  };
  // Store QStash message ID for cancellation
  if (qstashMessageId) {
    updateData.qstash_message_id = qstashMessageId;
  }

  const { error } = await supabase.from("posts").update(updateData).eq("id", postId);
  if (error) {
    console.error("[schedule-post] DB error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, qstashMessageId });
}

// Cancel a scheduled QStash message
export async function DELETE(request: Request) {
  const { postId } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the stored QStash message ID
  const { data: post } = await supabase
    .from("posts")
    .select("qstash_message_id")
    .eq("id", postId)
    .single();

  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";

  if (post?.qstash_message_id && qstashToken) {
    try {
      await fetch(`${qstashUrl}/v2/messages/${post.qstash_message_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${qstashToken}` },
      });
      console.log("[schedule-post] QStash cancelled:", post.qstash_message_id);
    } catch (e: any) {
      console.error("[schedule-post] QStash cancel error:", e.message);
    }
  }

  // Update DB
  await supabase
    .from("posts")
    .update({ status: "APPROVED", scheduled_at: null, qstash_message_id: null })
    .eq("id", postId);

  return NextResponse.json({ ok: true });
}
