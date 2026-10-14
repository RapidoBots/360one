import { Lock } from "lucide-react";

export function SchedulingLocked() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Lock className="size-7 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Staff Scheduling</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        This premium feature is not enabled for your restaurant. Contact your administrator to get access.
      </p>
    </div>
  );
}
