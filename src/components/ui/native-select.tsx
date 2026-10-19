import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Per the design system: selects stay a real <select> (accessible, mobile
// friendly, native open-state list) -- only the closed state is styled.
// `compact` matches the permissions-matrix cell spec (40/radius-10/13px);
// default matches the standard form-field spec (44/radius-12/14px).
export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select"> & { compact?: boolean }
>(function NativeSelect({ className, compact = false, children, ...props }, ref) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        className={cn(
          "w-full appearance-none border border-line-input bg-white font-medium text-ink outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          compact ? "h-10 rounded-[10px] pr-8 pl-2.5 text-[13px] font-semibold" : "h-11 rounded-xl pr-9 pl-3 text-sm",
          className
        )}
      >
        {children}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-muted",
          compact ? "right-2.5 size-3.5" : "right-3 size-4"
        )}
      />
    </div>
  );
});
