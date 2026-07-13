import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, title: "Step 1", subtitle: "Select Details" },
  { number: 2, title: "Step 2", subtitle: "Choose Time" },
  { number: 3, title: "Step 3", subtitle: "Your Information" },
];

export function StepProgress({ current }: { current: number }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-3">
      {STEPS.map((step, i) => (
        <div key={step.number} className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-base font-semibold",
                step.number <= current ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {step.number}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-sm font-semibold">{step.title}</span>
              <span className="block text-xs text-muted-foreground">{step.subtitle}</span>
            </span>
          </div>
          {i < STEPS.length - 1 && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
        </div>
      ))}
    </div>
  );
}
