import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
type Option = { value: string; label: ReactNode; disabled?: boolean };
export default function Select({
  value,
  onChange,
  children,
  disabled,
  className,
  "aria-label": label,
}: {
  value: string | number;
  onChange: (event: { target: { value: string } }) => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((child) => {
      const props = child.props as {
        value: string | number;
        children: ReactNode;
        disabled?: boolean;
      };
      return {
        value: String(props.value),
        label: props.children,
        disabled: props.disabled,
      } as Option;
    });
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [position, setPosition] = useState({
    left: 0,
    top: 0,
    width: 0,
    maxHeight: 240,
  });
  const selected = options.findIndex((o) => o.value === String(value));
  const close = (restore = true) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  const choose = (i: number) => {
    if (options[i] && !options[i].disabled) {
      onChange({ target: { value: options[i].value } });
      close();
    }
  };
  const show = () => {
    const r = trigger.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const height = Math.min(240, options.length * 34 + 8);
    setPosition({
      left: Math.max(
        8,
        Math.min(r.left, window.innerWidth - Math.max(180, r.width) - 8),
      ),
      top:
        below >= Math.min(height, 120)
          ? r.bottom + 5
          : Math.max(8, r.top - height - 5),
      width: Math.max(180, r.width),
      maxHeight: Math.max(
        100,
        Math.min(240, below >= 120 ? below : r.top - 12),
      ),
    });
    setIndex(Math.max(0, selected));
    setOpen(true);
  };
  useEffect(() => {
    if (!open) return;
    menu.current?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !menu.current?.contains(e.target as Node) &&
        !trigger.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const resize = () => setOpen(false);
    const scroll = (e: Event) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", resize);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", resize);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${index}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [index, open, id]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`minimal-select ${className ?? ""}`}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>{options[selected]?.label ?? "Choose…"}</span>
        <ChevronDown size={12} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            className="minimal-select-menu"
            role="listbox"
            aria-label={label ?? "Options"}
            tabIndex={-1}
            aria-activedescendant={`${id}-${index}`}
            style={position}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                close();
              } else if (e.key === "Tab") {
                close(false);
                trigger.current?.focus();
              } else if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                choose(index);
              } else if (
                ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
              ) {
                e.preventDefault();
                const step = e.key === "ArrowUp" ? -1 : 1;
                let next =
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? options.length - 1
                      : (index + step + options.length) % options.length;
                for (
                  let i = 0;
                  options[next]?.disabled && i < options.length;
                  i++
                )
                  next = (next + step + options.length) % options.length;
                setIndex(next);
              } else if (e.key.length === 1) {
                const found = options.findIndex(
                  (o) =>
                    !o.disabled &&
                    Children.toArray(o.label)
                      .join("")
                      .toLowerCase()
                      .startsWith(e.key.toLowerCase()),
                );
                if (found >= 0) setIndex(found);
              }
            }}
          >
            {options.map((o, i) => (
              <div
                id={`${id}-${i}`}
                key={o.value}
                role="option"
                aria-selected={i === selected}
                aria-disabled={o.disabled}
                data-focused={i === index}
                onPointerMove={() => setIndex(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
              >
                <span>{o.label}</span>
                {i === selected && <Check size={12} />}
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
