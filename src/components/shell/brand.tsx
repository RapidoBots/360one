import Image from "next/image";

export function Brand({ className }: { className?: string }) {
  return <Image src="/logo.png" alt="360One" width={2000} height={1003} className={className} unoptimized />;
}
