"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Post {
  id: string;
  title: string;
  status: string;
  scheduled_at: string | null;
}

interface Brand {
  id: string;
  preferred_days: number[];
  publish_time: string;
}

const DAY_NAMES = ["", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TIME_SLOTS = ["08:00", "12:00", "18:00"];

function computeSchedule(
  posts: Post[],
  preferredDays: number[],
  publishTime: string,
  existingScheduled: Post[]
): { postId: string; title: string; date: string; time: string }[] {
  const days = preferredDays.length > 0 ? preferredDays : [1];
  const baseTime = (publishTime || "09:00").slice(0, 5);

  // Collect already booked dates
  const bookedDates = new Map<string, number>();
  for (const p of existingScheduled) {
    if (p.scheduled_at) {
      const d = new Date(p.scheduled_at).toISOString().split("T")[0];
      bookedDates.set(d, (bookedDates.get(d) ?? 0) + 1);
    }
  }

  const schedule: { postId: string; title: string; date: string; time: string }[] = [];
  const now = new Date();
  let dayOffset = 1;

  for (const post of posts) {
    // Find next available preferred day
    while (dayOffset < 120) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + dayOffset);
      const jsDay = candidate.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      if (days.includes(isoDay)) {
        const dateStr = candidate.toISOString().split("T")[0];
        const count = bookedDates.get(dateStr) ?? 0;

        // Allow up to 3 posts per day with varied times
        if (count < 3) {
          const time = count === 0 ? baseTime : TIME_SLOTS[count] ?? baseTime;
          schedule.push({ postId: post.id, title: post.title, date: dateStr, time });
          bookedDates.set(dateStr, count + 1);

          // Move to next day for the next post
          if (count >= 0) dayOffset++;
          break;
        }
      }
      dayOffset++;
    }
  }

  return schedule;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const jsDay = d.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  return `${DAY_NAMES[isoDay]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export default function BulkSchedule({ posts, brand }: { posts: Post[]; brand: Brand }) {
  const router = useRouter();
  const [preview, setPreview] = useState<{ postId: string; title: string; date: string; time: string }[] | null>(null);
  const [applying, setApplying] = useState(false);

  const unscheduledApproved = posts.filter(
    (p) => (p.status === "APPROVED" || p.status === "DRAFT") && !p.scheduled_at
  );
  const scheduledPosts = posts.filter((p) => p.scheduled_at && p.status === "SCHEDULED");

  if (unscheduledApproved.length === 0) return null;

  const handlePreview = () => {
    const time = (brand.publish_time || "09:00").slice(0, 5);
    const schedule = computeSchedule(
      unscheduledApproved,
      brand.preferred_days ?? [1],
      time,
      scheduledPosts
    );
    setPreview(schedule);
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setApplying(true);
    const supabase = createClient();

    for (const item of preview) {
      const scheduledAt = `${item.date}T${item.time}:00Z`;
      await supabase
        .from("posts")
        .update({ status: "SCHEDULED", scheduled_at: scheduledAt })
        .eq("id", item.postId);
    }

    setPreview(null);
    setApplying(false);
    router.refresh();
  };

  if (preview) {
    return (
      <div className="mb-6 p-4 bg-surface-light border border-accent/20 rounded-xl">
        <h3 className="text-sm font-semibold text-white mb-3">
          Programacion propuesta ({preview.length} posts)
        </h3>
        <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
          {preview.map((item) => (
            <div key={item.postId} className="flex items-center gap-3 text-sm">
              <span className="text-blue-400 font-medium min-w-[110px]">
                {formatDate(item.date)} · {item.time}
              </span>
              <span className="text-neutral-300 truncate">{item.title}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={applying}
            className="bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            {applying ? "Aplicando..." : "Confirmar programacion"}
          </button>
          <button
            onClick={() => setPreview(null)}
            className="bg-surface-light hover:bg-surface-border text-neutral-300 font-medium px-5 py-2 rounded-lg transition-colors text-sm border border-surface-border"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handlePreview}
      className="text-xs text-accent hover:text-accent/80 transition-colors"
    >
      Programar {unscheduledApproved.length} post{unscheduledApproved.length > 1 ? "s" : ""} con IA
    </button>
  );
}
