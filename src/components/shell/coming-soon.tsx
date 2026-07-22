export function ComingSoon({ feature, phase }: { feature: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-16 text-center">
      <h2 className="text-lg font-semibold">{feature}</h2>
      <p className="text-base text-muted-foreground">Coming in {phase}.</p>
    </div>
  );
}
