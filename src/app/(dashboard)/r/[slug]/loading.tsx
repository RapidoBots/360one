import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center p-24">
      <Loader2 className="size-6 text-primary animate-spin" />
    </div>
  );
}
