"use client";

import { useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { SectionCard, SectionCardBody } from "@/components/ui/section-card";

export function EmbedSnippet({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const snippet = origin
    ? `<iframe src="${origin}/reservations/${slug}" width="100%" height="800" style="border:0"></iframe>`
    : "";

  async function handleCopy() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <SectionCard
      id="embed"
      icon={Link2}
      title="Embed on your website"
      description="Paste this snippet into your website's HTML to add a booking widget."
    >
      <SectionCardBody>
        <div className="flex flex-wrap items-start gap-3.5 rounded-[14px] bg-ink px-5 py-5">
          <code className="min-w-0 flex-1 font-mono text-[13px] leading-relaxed break-all whitespace-pre-wrap text-[#C7D2FE]">
            {snippet || "Loading..."}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!origin}
            className="flex h-9.5 shrink-0 items-center gap-2 rounded-[10px] border border-white/20 bg-white/10 px-3.5 text-[13px] font-semibold text-white hover:bg-white/15 disabled:opacity-50"
          >
            <Copy className="size-[15px]" />
            {copied ? "Copied" : "Copy snippet"}
          </button>
        </div>
      </SectionCardBody>
    </SectionCard>
  );
}
