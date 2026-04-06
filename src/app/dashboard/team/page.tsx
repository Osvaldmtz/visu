"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface Collaborator {
  id: string;
  email: string;
  role: string;
  assigned_brands: string[];
  created_at: string;
}

interface Brand {
  id: string;
  name: string;
}

export default function TeamPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteBrands, setInviteBrands] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBrands, setEditBrands] = useState<string[]>([]);

  const load = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    // Check if admin (owns brands)
    const { data: ownedBrands } = await supabase
      .from("brands")
      .select("id, name")
      .eq("user_id", user.id);

    if (!ownedBrands?.length) { router.push("/dashboard"); return; }
    setBrands(ownedBrands);

    // Load collaborators
    const { data: collabs } = await supabase
      .from("collaborators")
      .select("*");

    setCollaborators(collabs ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [router]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        password: invitePassword,
        assignedBrands: inviteBrands,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      setSaving(false);
      return;
    }

    setShowInvite(false);
    setInviteEmail("");
    setInvitePassword("");
    setInviteBrands([]);
    setSaving(false);
    load();
  };

  const handleUpdateBrands = async (collaboratorId: string) => {
    setSaving(true);
    const res = await fetch("/api/team/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId, assignedBrands: editBrands }),
    });

    if (res.ok) {
      setEditingId(null);
      load();
    }
    setSaving(false);
  };

  const handleRemove = async (collaboratorId: string, email: string) => {
    if (!confirm(`Eliminar a ${email} del equipo?`)) return;

    const res = await fetch("/api/team/remove", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collaboratorId }),
    });

    if (res.ok) load();
  };

  const toggleBrand = (brandId: string, list: string[], setter: (v: string[]) => void) => {
    setter(
      list.includes(brandId)
        ? list.filter((id) => id !== brandId)
        : [...list, brandId]
    );
  };

  const getBrandName = (id: string) => brands.find((b) => b.id === id)?.name ?? id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-neutral-400">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-accent">Visu</span>
          <span className="text-neutral-500">/</span>
          <span className="text-sm text-neutral-300">Equipo</span>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-neutral-400 hover:text-white transition-colors"
        >
          &larr; Dashboard
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Equipo</h1>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-accent hover:bg-accent/90 text-white font-medium px-4 py-2 rounded-lg transition-colors text-sm"
          >
            Invitar colaborador
          </button>
        </div>

        {/* Invite modal */}
        {showInvite && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-surface border border-surface-border rounded-xl p-6 w-full max-w-md">
              <h2 className="text-lg font-semibold mb-4">Invitar colaborador</h2>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full bg-surface-light border border-surface-border rounded-lg px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-accent"
                    placeholder="colaborador@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Contraseña temporal</label>
                  <input
                    type="text"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    className="w-full bg-surface-light border border-surface-border rounded-lg px-4 py-2.5 text-white placeholder-neutral-500 focus:outline-none focus:border-accent"
                    placeholder="Contraseña inicial"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Marcas asignadas</label>
                  <div className="flex flex-wrap gap-2">
                    {brands.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => toggleBrand(b.id, inviteBrands, setInviteBrands)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                          inviteBrands.includes(b.id)
                            ? "bg-accent/20 border-accent text-accent"
                            : "bg-surface-light border-surface-border text-neutral-400 hover:text-white"
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowInvite(false); setError(""); }}
                    className="flex-1 py-2.5 rounded-lg border border-surface-border text-neutral-400 hover:text-white transition-colors text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !inviteBrands.length}
                    className="flex-1 bg-accent hover:bg-accent/90 text-white py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {saving ? "Invitando..." : "Invitar"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Collaborators list */}
        {!collaborators.length ? (
          <div className="text-center py-16 border border-dashed border-surface-border rounded-xl">
            <p className="text-neutral-400 mb-2">No hay colaboradores</p>
            <p className="text-sm text-neutral-500">
              Invita a tu equipo para que gestionen contenido de tus marcas
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {collaborators.map((c) => (
              <div
                key={c.id}
                className="border border-surface-border rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">{c.email}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {c.role} &middot; {new Date(c.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (editingId === c.id) {
                          setEditingId(null);
                        } else {
                          setEditingId(c.id);
                          setEditBrands(c.assigned_brands);
                        }
                      }}
                      className="text-sm text-neutral-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-surface-border"
                    >
                      {editingId === c.id ? "Cancelar" : "Editar marcas"}
                    </button>
                    <button
                      onClick={() => handleRemove(c.id, c.email)}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-lg border border-surface-border"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>

                {editingId === c.id ? (
                  <div>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {brands.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBrand(b.id, editBrands, setEditBrands)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                            editBrands.includes(b.id)
                              ? "bg-accent/20 border-accent text-accent"
                              : "bg-surface-light border-surface-border text-neutral-400 hover:text-white"
                          }`}
                        >
                          {b.name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleUpdateBrands(c.id)}
                      disabled={saving}
                      className="bg-accent hover:bg-accent/90 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {c.assigned_brands.map((brandId) => (
                      <span
                        key={brandId}
                        className="px-2.5 py-1 rounded-md bg-surface-light text-xs text-neutral-300"
                      >
                        {getBrandName(brandId)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
