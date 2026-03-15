"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  image_url: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
}

const STATUS_DOT: Record<string, string> = {
  SCHEDULED: "bg-blue-400",
  APPROVED: "bg-green-400",
  PUBLISHED: "bg-[#7C3DE3]",
  DRAFT: "bg-yellow-400",
  DISCARDED: "bg-red-400",
};

const STATUS_BG: Record<string, string> = {
  SCHEDULED: "bg-blue-500/5",
  APPROVED: "bg-green-500/5",
  PUBLISHED: "bg-accent/5",
};

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// ISO weekday: 1=Mon..7=Sun
const ISO_DAY_LABELS: Record<number, string> = {
  1: "Lun", 2: "Mar", 3: "Mié", 4: "Jue", 5: "Vie", 6: "Sáb", 7: "Dom",
};

function getPostDate(post: Post): string | null {
  const d = post.scheduled_at || post.created_at;
  if (!d) return null;
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return null;
  }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Convert to Mon=0
}

export default function CalendarView({
  posts,
  preferredDays,
}: {
  posts: Post[];
  preferredDays: number[];
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const postsByDate = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const post of posts) {
      if (post.status === "DISCARDED") continue;
      const date = getPostDate(post);
      if (!date) continue;
      if (!map[date]) map[date] = [];
      map[date].push(post);
    }
    return map;
  }, [posts]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = today.toISOString().split("T")[0];

  const monthPosts = posts.filter((p) => {
    if (p.status === "DISCARDED") return false;
    const d = getPostDate(p);
    if (!d) return false;
    return d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`);
  });

  const scheduledCount = monthPosts.filter(
    (p) => p.status === "SCHEDULED" || p.status === "APPROVED"
  ).length;

  const goNext = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  };

  const goPrev = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  };

  // Build calendar grid cells
  const cells: { day: number | null; dateStr: string }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, dateStr: "" });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, dateStr });
  }

  // Check if a day is a preferred publishing day
  const isPreferredDay = (day: number) => {
    const date = new Date(year, month, day);
    const jsDay = date.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    return preferredDays.includes(isoDay);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={goPrev}
            className="p-2 hover:bg-surface-light rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold min-w-[200px] text-center">
            {MONTHS_ES[month]} {year}
          </h2>
          <button
            onClick={goNext}
            className="p-2 hover:bg-surface-light rounded-lg transition-colors text-neutral-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-neutral-400">
          {scheduledCount} post{scheduledCount !== 1 ? "s" : ""} programado{scheduledCount !== 1 ? "s" : ""} este mes
        </p>
      </div>

      {/* Desktop: Monthly grid */}
      <div className="hidden md:block">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {DAYS_ES.map((d) => (
            <div key={d} className="text-xs text-neutral-500 text-center py-2 font-medium">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-surface-border rounded-xl overflow-hidden">
          {cells.map((cell, i) => {
            if (cell.day === null) {
              return <div key={i} className="bg-surface min-h-[120px]" />;
            }

            const dayPosts = postsByDate[cell.dateStr] ?? [];
            const isToday = cell.dateStr === todayStr;
            const preferred = isPreferredDay(cell.day);

            // Pick dominant status color for background
            let bgClass = "bg-surface";
            if (dayPosts.length > 0) {
              const dominant = dayPosts[0].status;
              bgClass = STATUS_BG[dominant] ?? "bg-surface";
            }

            return (
              <div
                key={i}
                className={`${bgClass} min-h-[120px] p-2 transition-colors`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-medium ${
                      isToday
                        ? "bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center"
                        : "text-neutral-400"
                    }`}
                  >
                    {cell.day}
                  </span>
                  {preferred && dayPosts.length === 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-accent/30" />
                  )}
                </div>

                <div className="space-y-1">
                  {dayPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/dashboard/post/${post.id}`}
                      className="flex items-center gap-1.5 p-1 rounded hover:bg-white/5 transition-colors group"
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[post.status] ?? "bg-neutral-500"}`} />
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-6 h-6 rounded object-cover shrink-0"
                        />
                      )}
                      <span className="text-[10px] text-neutral-300 truncate group-hover:text-white">
                        {post.title}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: Weekly list */}
      <div className="md:hidden space-y-2">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayPosts = postsByDate[dateStr] ?? [];
          const isToday = dateStr === todayStr;
          const preferred = isPreferredDay(day);
          const date = new Date(year, month, day);
          const jsDay = date.getDay();
          const isoDay = jsDay === 0 ? 7 : jsDay;
          const dayLabel = ISO_DAY_LABELS[isoDay];

          if (dayPosts.length === 0 && !preferred && !isToday) return null;

          return (
            <div
              key={day}
              className={`flex items-start gap-4 p-3 rounded-xl border transition-colors ${
                isToday
                  ? "border-accent/30 bg-accent/5"
                  : "border-surface-border bg-surface-light"
              }`}
            >
              <div className="text-center min-w-[40px]">
                <span className={`text-lg font-bold ${isToday ? "text-accent" : "text-neutral-300"}`}>
                  {day}
                </span>
                <p className="text-[10px] text-neutral-500">{dayLabel}</p>
              </div>

              <div className="flex-1 space-y-2">
                {dayPosts.length === 0 ? (
                  <span className="text-xs text-neutral-500">Dia de publicacion</span>
                ) : (
                  dayPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/dashboard/post/${post.id}`}
                      className="flex items-center gap-3 p-2 -m-1 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[post.status] ?? "bg-neutral-500"}`} />
                      {post.image_url && (
                        <img
                          src={post.image_url}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-neutral-200 truncate">{post.title}</p>
                        <p className="text-[10px] text-neutral-500">{post.status}</p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
