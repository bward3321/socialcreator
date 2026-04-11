"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "all", label: "All time" },
];

export function DateRangeSelector({ current }: { current: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "30") {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    router.push(`/dashboard${params.size > 0 ? `?${params}` : ""}`);
  }

  return (
    <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => handleChange(r.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
            current === r.value
              ? "bg-purple/10 text-purple border border-purple/30"
              : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
