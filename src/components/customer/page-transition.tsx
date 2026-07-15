"use client";

import { useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";

/**
 * Entrada rápida e suave em cada troca de rota do app cliente.
 * Usa GSAP (power2.out ~220ms). Respeita prefers-reduced-motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      gsap.set(el, { autoAlpha: 1, y: 0, clearProps: "transform" });
      return;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 12 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.22,
          ease: "power2.out",
          overwrite: "auto",
          onComplete: () => {
            gsap.set(el, { clearProps: "transform" });
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [pathname]);

  return (
    <div ref={rootRef} className="page-transition min-h-0 w-full">
      {children}
    </div>
  );
}
