import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { canAnimate } from "./motion";

/**
 * Staggered fade + slide-up entrance for a container's direct children on
 * mount. Returns a ref to attach to the container. No-op under reduced motion.
 */
export function useEntrance<T extends HTMLElement = HTMLDivElement>(selector = ":scope > *") {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !canAnimate()) return;
    const ctx = gsap.context(() => {
      gsap.from(gsap.utils.toArray<HTMLElement>(selector, root), {
        y: 12,
        autoAlpha: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.06,
      });
    }, root);
    return () => ctx.revert();
  }, [selector]);

  return ref;
}
