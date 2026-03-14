"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const INDUSTRIES = [
  "Psychology / Mental Health",
  "Healthcare",
  "Education",
  "Marketing Agency",
  "E-commerce",
  "SaaS / Technology",
  "Real Estate",
  "Fitness / Wellness",
  "Food & Beverage",
  "Other",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    logo_url: "",
    primary_color: "#7C3DE3",
    industry: "",
    ig_handle: "",
    fb_page: "",
    late_api_key: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { error } = await supabase.from("brands").insert({
      user_id: user.id,
      ...form,
    });

    if (error) {
      console.error("Error saving brand:", error);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Set up your brand</h1>
          <p className="text-neutral-400 text-sm">
            We need a few details to generate content for you.
          </p>
        </div>

        <div className="space-y-4">
          <Field label="Brand name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Kalyo"
              required
            />
          </Field>

          <Field label="Logo URL">
            <input
              type="url"
              value={form.logo_url}
              onChange={(e) => update("logo_url", e.target.value)}
              placeholder="https://example.com/logo.svg"
            />
          </Field>

          <Field label="Primary color">
            <div className="flex gap-3 items-center">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => update("primary_color", e.target.value)}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                type="text"
                value={form.primary_color}
                onChange={(e) => update("primary_color", e.target.value)}
                className="flex-1"
                placeholder="#7C3DE3"
              />
            </div>
          </Field>

          <Field label="Industry" required>
            <select
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
              required
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Instagram handle">
              <input
                type="text"
                value={form.ig_handle}
                onChange={(e) => update("ig_handle", e.target.value)}
                placeholder="@kalyo_app"
              />
            </Field>
            <Field label="Facebook page">
              <input
                type="text"
                value={form.fb_page}
                onChange={(e) => update("fb_page", e.target.value)}
                placeholder="kalyoapp"
              />
            </Field>
          </div>

          <Field label="Late API key">
            <input
              type="password"
              value={form.late_api_key}
              onChange={(e) => update("late_api_key", e.target.value)}
              placeholder="sk_..."
            />
          </Field>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? "Saving..." : "Continue to dashboard"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-neutral-300 mb-1.5 block">
        {label}
        {required && <span className="text-accent ml-1">*</span>}
      </span>
      <div className="[&_input]:w-full [&_input]:bg-surface-light [&_input]:border [&_input]:border-surface-border [&_input]:rounded-lg [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-white [&_input]:placeholder-neutral-500 [&_input]:focus:outline-none [&_input]:focus:border-accent [&_select]:w-full [&_select]:bg-surface-light [&_select]:border [&_select]:border-surface-border [&_select]:rounded-lg [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-white [&_select]:focus:outline-none [&_select]:focus:border-accent">
        {children}
      </div>
    </label>
  );
}
