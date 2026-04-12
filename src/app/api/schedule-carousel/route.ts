import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { carouselId, scheduledAt, caption } = await request.json();

  if (!carouselId || !scheduledAt) {
    return NextResponse.json({ error: "Missing carouselId or scheduledAt" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetDate = new Date(scheduledAt);
  const now = new Date();
  const delaySecs = Math.max(0, Math.floor((targetDate.getTime() - now.getTime()) / 1000));

  if (delaySecs <= 0) {
    return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 });
  }

  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";
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
        body: JSON.stringify({ carouselId }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        console.error("[schedule-carousel] QStash error:", res.status, errBody);
      } else {
        const data = await res.json();
        qstashMessageId = data.messageId ?? null;
        console.log("[schedule-carousel] QStash scheduled:", qstashMessageId, `delay=${delaySecs}s`);
      }
    } catch (e: any) {
      console.error("[schedule-carousel] QStash error:", e.message);
    }
  }

  const updateData: Record<string, any> = {
    status: "SCHEDULED",
    scheduled_at: scheduledAt,
    caption: caption ?? undefined,
  };
  if (qstashMessageId) {
    updateData.qstash_message_id = qstashMessageId;
  }

  const { error } = await supabase
    .from("carousel_posts")
    .update(updateData)
    .eq("id", carouselId);

  if (error) {
    console.error("[schedule-carousel] DB error:", error);
    return NextResponse.json({ error: "Failed to update carousel" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, qstashMessageId });
}

export async function DELETE(request: Request) {
  const { carouselId } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: carousel } = await supabase
    .from("carousel_posts")
    .select("qstash_message_id")
    .eq("id", carouselId)
    .single();

  const qstashToken = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";

  if (carousel?.qstash_message_id && qstashToken) {
    try {
      await fetch(`${qstashUrl}/v2/messages/${carousel.qstash_message_id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${qstashToken}` },
      });
    } catch (e: any) {
      console.error("[schedule-carousel] QStash cancel error:", e.message);
    }
  }

  await supabase
    .from("carousel_posts")
    .update({ status: "APPROVED", scheduled_at: null, qstash_message_id: null })
    .eq("id", carouselId);

  return NextResponse.json({ ok: true });
}
