import { useCallback, useRef, useState } from "react";

type DragScrollHandlers = {
  onMouseDown: React.MouseEventHandler<HTMLElement>;
  onMouseMove: React.MouseEventHandler<HTMLElement>;
  onMouseUp: React.MouseEventHandler<HTMLElement>;
  onMouseLeave: React.MouseEventHandler<HTMLElement>;
};

/**
 * Adds click-and-drag scrolling behavior for vertically scrollable containers.
 * Intended for desktop mouse interactions.
 */
export function useDragScrollVertical<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const stateRef = useRef({
    startY: 0,
    startScrollTop: 0,
    active: false,
  });

  const onMouseDown = useCallback<React.MouseEventHandler<HTMLElement>>((e) => {
    // Only left click
    if (e.button !== 0) return;
    if (!ref.current) return;

    stateRef.current.active = true;
    setIsDragging(true);

    const el = ref.current;
    stateRef.current.startY = e.pageY - el.offsetTop;
    stateRef.current.startScrollTop = el.scrollTop;
  }, []);

  const onMouseMove = useCallback<React.MouseEventHandler<HTMLElement>>((e) => {
    if (!stateRef.current.active) return;
    if (!ref.current) return;

    e.preventDefault();
    const el = ref.current;
    const y = e.pageY - el.offsetTop;
    const walk = y - stateRef.current.startY;
    el.scrollTop = stateRef.current.startScrollTop - walk;
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
