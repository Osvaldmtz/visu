import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const brandId = formData.get("brandId") as string | null;
  const variant = (formData.get("variant") as string) || "light";

  if (!file || !brandId) {
    return NextResponse.json(
      { error: "file and brandId are required" },
      { status: 400 }
    );
  }

  if (variant !== "light" && variant !== "dark") {
    return NextResponse.json(
      { error: "variant must be 'light' or 'dark'" },
      { status: 400 }
    );
  }

  // Verify user owns the brand
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("user_id", user.id)
    .single();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const ext = file.name.split(".").pop() || "png";
  const storagePath = `${brandId}/logo-${variant}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("logos")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("logos").getPublicUrl(storagePath);

  // Update brand with the appropriate logo URL column
  const updateField = variant === "light" ? "logo_light_url" : "logo_dark_url";
  await supabase
    .from("brands")
    .update({ [updateField]: publicUrl, logo_storage_path: storagePath })
    .eq("id", brandId);

  return NextResponse.json({ variant, storagePath, publicUrl });
}
