"use client";

import { useState } from "react";

const TABS = [
  { label: "Profile", id: "profile" },
  { label: "Embed", id: "embed" },
  { label: "Hours", id: "hours" },
  { label: "Overrides", id: "overrides" },
  { label: "Team", id: "team" },
  { label: "Permissions", id: "permissions" },
];

export function SettingsTabs() {
  const [active, setActive] = useState(TABS[0]!.id);

  function goTo(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-label="Settings sections" className="flex min-w-0 gap-2 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => goTo(t.id)}
          className={`flex h-[38px] shrink-0 items-center rounded-full px-4 text-[13.5px] font-semibold whitespace-nowrap ${
            active === t.id ? "bg-ink text-white" : "bg-[#EEF0F6] text-[#334155] hover:bg-[#E9ECF5]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
