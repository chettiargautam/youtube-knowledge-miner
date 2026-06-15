"use client";

import { useEffect, useRef } from "react";

const SPOTLIGHT_SELECTOR = [
  "button",
  "a",
  "input",
  "[role='button']",
  "[data-slot='card']",
  "[data-cursor-light]",
].join(",");

export function CursorSpotlight() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const cursor = cursorRef.current;

    function clearActiveElement() {
      const activeElement = activeElementRef.current;

      if (activeElement) {
        activeElement.removeAttribute("data-cursor-light-active");
      }

      activeElementRef.current = null;
    }

    function updateCursor() {
      frameRef.current = null;

      if (!cursor) {
        return;
      }

      cursor.style.transform = `translate3d(${pointRef.current.x}px, ${pointRef.current.y}px, 0) translate(-50%, -50%)`;
    }

    function moveCursor(clientX: number, clientY: number, target: EventTarget | null) {
      pointRef.current = { x: clientX, y: clientY };

      if (frameRef.current === null) {
        frameRef.current = window.requestAnimationFrame(updateCursor);
      }

      const targetElement = target instanceof Element ? target : null;
      const nextElement = targetElement?.closest(SPOTLIGHT_SELECTOR) as HTMLElement | null;

      if (nextElement !== activeElementRef.current) {
        clearActiveElement();
        activeElementRef.current = nextElement;
      }

      if (!nextElement || nextElement.hasAttribute("disabled")) {
        clearActiveElement();
        return;
      }

      const bounds = nextElement.getBoundingClientRect();
      nextElement.style.setProperty("--cursor-light-x", `${clientX - bounds.left}px`);
      nextElement.style.setProperty("--cursor-light-y", `${clientY - bounds.top}px`);
      nextElement.setAttribute("data-cursor-light-active", "true");
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") {
        clearActiveElement();
        return;
      }

      moveCursor(event.clientX, event.clientY, event.target);
    }

    function onMouseMove(event: MouseEvent) {
      moveCursor(event.clientX, event.clientY, event.target);
    }

    function onPointerLeave() {
      clearActiveElement();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMouseMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      clearActiveElement();
    };
  }, []);

  return <div ref={cursorRef} className="cursor-orb" aria-hidden="true" />;
}
