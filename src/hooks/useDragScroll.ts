import { useCallback, useRef, useState } from "react";

type DragScrollHandlers = {
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  onMouseMove: React.MouseEventHandler<HTMLElement>;
  onMouseUp: React.MouseEventHandler<HTMLElement>;
  onMouseLeave: React.MouseEventHandler<HTMLElement>;
};

/**
 * Adds click-and-drag scrolling behavior for horizontally scrollable containers.
 * Intended for desktop mouse interactions.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const stateRef = useRef({
    startX: 0,
    startScrollLeft: 0,
    active: false,
  });

  const onMouseDown = useCallback<React.MouseEventHandler<HTMLElement>>((e) => {
    // Only left click
    if (e.button !== 0) return;
    if (!ref.current) return;

    stateRef.current.active = true;
    setIsDragging(true);

    const el = ref.current;
    stateRef.current.startX = e.pageX - el.offsetLeft;
    stateRef.current.startScrollLeft = el.scrollLeft;
  }, []);

  const onMouseMove = useCallback<React.MouseEventHandler<HTMLElement>>((e) => {
    if (!stateRef.current.active) return;
    if (!ref.current) return;

    e.preventDefault();
    const el = ref.current;
    const x = e.pageX - el.offsetLeft;
    const walk = x - stateRef.current.startX;
    el.scrollLeft = stateRef.current.startScrollLeft - walk;
  }, []);

  const endDrag = useCallback(() => {
    if (!stateRef.current.active) return;
    stateRef.current.active = false;
    setIsDragging(false);
  }, []);

  const handlers: DragScrollHandlers = {
    onMouseDown,
    onMouseMove,
    onMouseUp: endDrag,
    onMouseLeave: endDrag,
  };

  return { ref, isDragging, handlers };
}
