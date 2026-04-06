import { SupabaseClient } from "@supabase/supabase-js";

export async function getAccessibleBrands(supabase: SupabaseClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Query owned brands explicitly (does not depend on collaborator subquery in RLS)
  const { data: owned } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id);

  // Query brands assigned via collaborator role
  const { data: collab } = await supabase
    .from("collaborators")
    .select("assigned_brands")
    .eq("id", user.id)
    .single();

  const assignedIds: string[] = collab?.assigned_brands ?? [];

  if (!assignedIds.length) return owned ?? [];

  const { data: assignedBrands } = await supabase
    .from("brands")
    .select("*")
    .in("id", assignedIds);

  // Merge owned + assigned, deduplicate by id
  const all = [...(owned ?? []), ...(assignedBrands ?? [])];
  const seen = new Set<string>();
  return all.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
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
