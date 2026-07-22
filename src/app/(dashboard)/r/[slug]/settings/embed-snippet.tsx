"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-3 rounded-[5px] border border-border p-5">
      <h2 className="text-base font-semibold">Embed on your website</h2>
      <p className="text-sm text-muted-foreground">
        Paste this snippet into your website&apos;s HTML to add a booking widget.
      </p>
      <pre className="overflow-x-auto rounded-[5px] border border-border bg-muted p-3 text-xs">
        <code>{snippet || "Loading..."}</code>
      </pre>
      <Button variant="outline" className="h-9" onClick={handleCopy} disabled={!origin}>
        {copied ? "Copied!" : "Copy snippet"}
      </Button>
    </div>
  );
}
