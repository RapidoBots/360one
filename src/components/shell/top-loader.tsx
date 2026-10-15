"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { usePathname } from "next/navigation";

export function TopLoader({ color = "#0243c4" }: { color?: string }) {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(null);
  const prevPath = useRef(pathname);

  const start = useCallback(() => {
    setProgress(10);
    setVisible(true);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + (90 - p) * 0.1));
    }, 200);
  }, []);

  const done = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    setProgress(100);
    setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 300);
  }, []);

  useEffect(() => {
    if (prevPath.current !== pathname) {
      done();
      prevPath.current = pathname;
    }
  }, [pathname, done]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || anchor.target === "_blank") return;
      if (href.split("?")[0] !== pathname) start();
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [pathname, start]);

  return (
    <div
      className="fixed top-0 left-0 z-[9999] h-[3px] transition-all duration-200 ease-out"
      style={{
        width: `${progress}%`,
        backgroundColor: color,
        opacity: visible ? 1 : 0,
      }}
    />
  );
}
