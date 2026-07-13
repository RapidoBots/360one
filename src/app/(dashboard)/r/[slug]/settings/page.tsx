import { ComingSoon } from "@/components/shell/coming-soon";
import { EmbedSnippet } from "./embed-snippet";

export default async function RestaurantSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <EmbedSnippet slug={slug} />
      <ComingSoon feature="Other settings" phase="Phase 8" />
    </div>
  );
}
