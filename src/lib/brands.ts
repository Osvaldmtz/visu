import { SupabaseClient } from "@supabase/supabase-js";

export async function getAccessibleBrands(supabase: SupabaseClient) {
  // RLS handles access: returns owned brands + collaborator-assigned brands
  const { data } = await supabase.from("brands").select("*");
  return data ?? [];
}

export async function getActiveBrand(
  supabase: SupabaseClient,
  activeBrandId?: string | null
) {
  const brands = await getAccessibleBrands(supabase);
  if (!brands.length) return null;

  if (activeBrandId) {
    const found = brands.find((b) => b.id === activeBrandId);
    if (found) return found;
  }

  return brands[0];
}

export async function isCollaborator(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("collaborators")
    .select("id")
    .eq("id", user.id)
    .single();

  return !!data;
}

export async function isAdmin(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  // Admin = owns at least one brand
  const { data } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  return (data ?? []).length > 0;
}
