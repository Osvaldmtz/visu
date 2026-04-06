"use client";

import { useRouter } from "next/navigation";

interface Brand {
  id: string;
  name: string;
}

export default function BrandSelector({
  brands,
  activeBrandId,
}: {
  brands: Brand[];
  activeBrandId: string;
}) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    document.cookie = `visu-active-brand=${e.target.value};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  };

  return (
    <select
      value={activeBrandId}
      onChange={handleChange}
      className="bg-transparent text-sm text-neutral-300 border border-surface-border rounded-md px-2 py-1 focus:outline-none focus:border-accent cursor-pointer"
    >
      {brands.map((b) => (
        <option key={b.id} value={b.id} className="bg-surface text-white">
          {b.name}
        </option>
      ))}
    </select>
  );
}
