import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is a brand owner
  const { data: ownedBrands } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id);

  if (!ownedBrands?.length) {
    return NextResponse.json({ error: "Only brand owners can update collaborators" }, { status: 403 });
  }

  const { collaboratorId, assignedBrands } = await request.json();

  if (!collaboratorId || !assignedBrands) {
    return NextResponse.json({ error: "collaboratorId and assignedBrands required" }, { status: 400 });
  }

  // Verify caller owns all assigned brands
  const ownedIds = new Set(ownedBrands.map((b) => b.id));
  const allOwned = assignedBrands.every((id: string) => ownedIds.has(id));
  if (!allOwned) {
    return NextResponse.json({ error: "Can only assign brands you own" }, { status: 403 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin
    .from("collaborators")
    .update({ assigned_brands: assignedBrands })
    .eq("id", collaboratorId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
