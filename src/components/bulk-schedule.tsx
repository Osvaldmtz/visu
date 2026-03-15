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

// Optimal posting times per ISO day (1=Mon..7=Sun)
const OPTIMAL_TIMES: Record<number, string> = {
  1: "08:00", // Lunes
  2: "08:00", // Martes
  3: "13:00", // Miercoles
  4: "08:00", // Jueves
  5: "18:00", // Viernes
  6: "10:00", // Sabado
  7: "20:00", // Domingo
};

interface ScheduleItem {
  postId: string;
  title: string;
  date: string;
  time: string;
  dayName: string;
}

function computeSchedule(
  posts: Post[],
  preferredDays: number[],
  existingScheduled: Post[]
): ScheduleItem[] {
  const days = preferredDays.length > 0 ? preferredDays : [1];

  const bookedDates = new Map<string, number>();
  for (const p of existingScheduled) {
    if (p.scheduled_at) {
      try {
        const d = new Date(p.scheduled_at).toISOString().split("T")[0];
        bookedDates.set(d, (bookedDates.get(d) ?? 0) + 1);
      } catch { /* skip */ }
    }
  }

  const schedule: ScheduleItem[] = [];
  const now = new Date();
  let dayOffset = 1;

  for (const post of posts) {
    while (dayOffset < 120) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + dayOffset);
      const jsDay = candidate.getDay();
      const isoDay = jsDay === 0 ? 7 : jsDay;

      if (days.includes(isoDay)) {
        const dateStr = candidate.toISOString().split("T")[0];
        const count = bookedDates.get(dateStr) ?? 0;

        if (count < 1) {
          const time = OPTIMAL_TIMES[isoDay] ?? "09:00";
          schedule.push({
            postId: post.id,
            title: post.title,
            date: dateStr,
            time,
            dayName: DAY_NAMES[isoDay],
          });
          bookedDates.set(dateStr, count + 1);
          dayOffset++;
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
  const [preview, setPreview] = useState<ScheduleItem[] | null>(null);
  const [applying, setApplying] = useState(false);

  const unscheduledApproved = posts.filter(
    (p) => (p.status === "APPROVED" || p.status === "DRAFT") && !p.scheduled_at
  );
  const scheduledPosts = posts.filter((p) => p.scheduled_at && p.status === "SCHEDULED");

  if (unscheduledApproved.length === 0) return null;

  const handlePreview = () => {
    const schedule = computeSchedule(unscheduledApproved, brand.preferred_days ?? [1], scheduledPosts);
    setPreview(schedule);
  };

  const updateTime = (idx: number, time: string) => {
    if (!preview) return;
    const updated = [...preview];
    updated[idx] = { ...updated[idx], time };
    setPreview(updated);
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
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {preview.map((item, idx) => (
            <div key={item.postId} className="flex items-center gap-2 text-sm">
              <span className="text-blue-400 font-medium min-w-[90px] text-xs">
                {formatDate(item.date)}
              </span>
              <input
                type="time"
                value={item.time}
                onChange={(e) => updateTime(idx, e.target.value)}
                className="w-20 bg-surface border border-surface-border rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-accent"
              />
              <span className="text-neutral-300 truncate text-xs flex-1">{item.title}</span>
              <span className="text-[10px] text-accent/60 shrink-0">Sugerido por IA</span>
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
