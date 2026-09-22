"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Keep the native disclosure, while dismissing it after same-page navigation. */
export function MobileNav({ children }: { children: ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const disclosure = menu.current;
    if (!disclosure) return;
    const close = () => {
      disclosure.open = false;
      disclosure.querySelector("summary")?.focus();
    };
    const onClick = (event: MouseEvent) => {
      // Native links already support Enter; observe their activation without
      // changing the navigation landmark into a synthetic button.
      if ((event.target as HTMLElement).closest("a")) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && disclosure.open) {
        event.preventDefault();
        close();
      }
    };
    disclosure.addEventListener("click", onClick);
    disclosure.addEventListener("keydown", onKey);
    return () => {
      disclosure.removeEventListener("click", onClick);
      disclosure.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details className="mobile-nav" ref={menu}>
      <summary>Menu</summary>
      <nav aria-label="Mobile navigation">
        {children}
      </nav>
    </details>
  );
}
