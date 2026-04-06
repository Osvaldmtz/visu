import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function DELETE(request: Request) {
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
    return NextResponse.json({ error: "Only brand owners can remove collaborators" }, { status: 403 });
  }

  const { collaboratorId } = await request.json();

  if (!collaboratorId) {
    return NextResponse.json({ error: "collaboratorId required" }, { status: 400 });
  }

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Delete collaborator row first
  const { error: deleteError } = await admin
    .from("collaborators")
    .delete()
    .eq("id", collaboratorId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Delete auth user
  const { error: authError } = await admin.auth.admin.deleteUser(collaboratorId);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
