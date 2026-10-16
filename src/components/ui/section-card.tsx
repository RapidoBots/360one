import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionCard({
  id,
  icon: Icon,
  title,
  description,
  headerRight,
  children,
  footer,
  className,
}: {
  id?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  headerRight?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "min-w-0 scroll-mt-22 overflow-hidden rounded-[20px] border border-line-card bg-white shadow-card",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-6">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-primary/10 text-primary">
            <Icon className="size-[22px]" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink">{title}</h2>
            <p className="mt-0.5 text-[13.5px] text-ink-muted">{description}</p>
          </div>
        </div>
        {headerRight}
      </div>
      {children}
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line-divider bg-surface-footer px-7 py-4">
          {footer}
        </div>
      )}
    </section>
  );
}

export function SectionCardBody({
  label,
  children,
  className,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-5 border-t border-line-divider p-7", className)}>
      {label && (
        <div className="text-xs font-bold tracking-wider text-ink-muted uppercase">{label}</div>
      )}
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-semibold text-ink">{children}</span>;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <span className="text-[12.5px] leading-relaxed text-ink-muted">{children}</span>;
}
