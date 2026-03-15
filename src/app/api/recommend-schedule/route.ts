import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

const DAY_NAMES: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miercoles", 4: "Jueves",
  5: "Viernes", 6: "Sabado", 7: "Domingo",
};

export async function POST(request: Request) {
  const { brandId } = await request.json();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("name, industry, preferred_days")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .single();

  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const preferredDays = brand.preferred_days?.length ? brand.preferred_days : [1, 5];

  // Pick the first preferred day and its optimal time
  const primaryDay = preferredDays[0];
  const time = OPTIMAL_TIMES[primaryDay] ?? "09:00";

  const dayList = preferredDays.map((d: number) => DAY_NAMES[d]).join(" y ");
  const timeList = preferredDays
    .map((d: number) => `${DAY_NAMES[d]} ${OPTIMAL_TIMES[d] ?? "09:00"}`)
    .join(", ");

  return NextResponse.json({
    days: preferredDays,
    time,
    reason: `Horarios optimos para ${brand.industry || "tu audiencia"} en LATAM: ${timeList}. Mayor engagement en ${dayList}.`,
  });
}
