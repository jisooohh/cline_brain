// Ported from kuku-mom/kuku components/layout/resize_handle.tsx (c690bb6).
import { useEffect, useRef, useState, type PointerEvent } from "react";
import "./resize_grip.css";
export default function ResizeHandle(props: {
  direction: "col" | "row";
  getValue: () => number;
  onResize: (value: number) => void;
  reverse?: boolean;
  label?: string;
}) {
  const [active, setActive] = useState(false);
  const teardown = useRef<(() => void) | null>(null);
  const isCol = props.direction === "col";
  useEffect(() => () => teardown.current?.(), []);
  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.currentTarget.focus();
    teardown.current?.();
    setActive(true);
    const startPos = isCol ? e.clientX : e.clientY;
    const startValue = props.getValue();
    document.body.style.userSelect = "none";
    document.body.style.cursor = isCol ? "col-resize" : "row-resize";
    function onPointerMove(event: globalThis.PointerEvent) {
      const delta = (isCol ? event.clientX : event.clientY) - startPos;
      props.onResize(props.reverse ? startValue - delta : startValue + delta);
    }
    function cleanup() {
      setActive(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", cleanup);
      document.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("blur", cleanup);
      teardown.current = null;
    }
    teardown.current = cleanup;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", cleanup);
    document.addEventListener("pointercancel", cleanup);
    window.addEventListener("blur", cleanup);
  }
  return (
    <div
      className={`resize-handle ${isCol ? "col" : "row"}`}
      onPointerDown={onPointerDown}
      role="separator"
      aria-label={props.label ?? (isCol ? "Resize sidebar" : "Resize terminal")}
      aria-orientation={isCol ? "vertical" : "horizontal"}
      tabIndex={0}
      onKeyDown={(e) => {
        const delta = ["ArrowRight", "ArrowDown"].includes(e.key)
          ? 16
          : ["ArrowLeft", "ArrowUp"].includes(e.key)
            ? -16
            : 0;
        if (delta) {
          e.preventDefault();
          props.onResize(props.getValue() + (props.reverse ? -delta : delta));
        }
      }}
    >
      <div
        className={`kuku-resize-grip kuku-resize-grip--${props.direction}`}
        data-active={active ? "" : undefined}
      />
    </div>
  );
}
