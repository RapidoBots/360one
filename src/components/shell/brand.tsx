import Image from "next/image";

export function Brand({ className }: { className?: string }) {
  // Every usage sits above the fold (nav, sign-in header, widget footer) --
  // priority skips lazy-loading's IntersectionObserver/hydration dependency
  // entirely, so it can't silently fail to ever trigger on a static page.
  return (
    <Image src="/logo.png" alt="360One" width={2000} height={1003} className={className} unoptimized priority />
  );
}
