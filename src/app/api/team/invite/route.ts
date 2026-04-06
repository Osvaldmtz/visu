import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify caller is a brand owner (admin)
  const { data: ownedBrands } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id);

  if (!ownedBrands?.length) {
    return NextResponse.json({ error: "Only brand owners can invite collaborators" }, { status: 403 });
  }

  const { email, password, assignedBrands } = await request.json();

  if (!email || !password || !assignedBrands?.length) {
    return NextResponse.json({ error: "Email, password, and at least one brand required" }, { status: 400 });
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

  // Create auth user
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 });
  }

  // Insert collaborator row
  const { error: insertError } = await admin.from("collaborators").insert({
    id: newUser.user.id,
    email,
    role: "collaborator",
    assigned_brands: assignedBrands,
  });

  if (insertError) {
    // Rollback: delete the auth user if collaborator insert fails
    await admin.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, collaboratorId: newUser.user.id });
}
