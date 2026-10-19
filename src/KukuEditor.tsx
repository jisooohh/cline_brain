import { useEffect, useRef, useState } from "react";
import type { Editor } from "prosekit/core";
import { createDocumentEditor, markdownService } from "./vendor/kuku/editor";
import { installWebKitCompositionWorkaround } from "./vendor/kuku/upstream/components/editor/system/ime_composition_workaround";
import {
  registerDefaultEditorSlashItems,
  filterEditorSlashItems,
  type EditorSlashItem,
} from "./vendor/kuku/upstream/plugins/builtin/core_editor/slash_items";
import { registerAnchorHandler } from "./vendor/kuku/upstream/plugins/anchor_handlers";
import "./vendor/kuku/upstream/styles/editor.css";
import "./vendor/kuku/upstream/styles/wikilink.css";
registerDefaultEditorSlashItems();
type Menu = {
  from: number;
  to: number;
  x: number;
  y: number;
  items: EditorSlashItem[];
  index: number;
};
export default function KukuEditor({
  value,
  onChange,
  onLink,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onLink: (title: string) => void;
  disabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const callbacks = useRef({ onChange, onLink });
  callbacks.current = { onChange, onLink };
  const initial = useRef(value);
  const last = useRef(value);
  const replacing = useRef(false);
  const [menu, setMenu] = useState<Menu | null>(null);
  const menuRef = useRef<Menu | null>(null);
  const [error, setError] = useState("");
  const updateMenu = (m: Menu | null) => {
    menuRef.current = m;
    setMenu(m);
  };
  const execute = (item: EditorSlashItem) => {
    const e = editor.current,
      m = menuRef.current;
    if (!e) return;
    if (m) e.view.dispatch(e.view.state.tr.delete(m.from, m.to));
    updateMenu(null);
    e.view.focus();
    void item.execute(e);
  };
  useEffect(() => {
    if (!host.current) return;
    let e: Editor;
    try {
      e = createDocumentEditor(initial.current, (text) => {
        if (!replacing.current) {
          last.current = text;
          callbacks.current.onChange(text);
        }
        requestAnimationFrame(refreshMenu);
      });
      e.mount(host.current);
    } catch (err) {
      setError(String(err));
      return;
    }
    editor.current = e;
    e.view.dom.setAttribute("aria-label", "Document editor");
    e.view.dom.setAttribute("role", "textbox");
    e.view.dom.setAttribute("aria-multiline", "true");
    const ime = installWebKitCompositionWorkaround(e.view);
    const link = registerAnchorHandler("a[data-wikilink]", (a) => {
      const target = a.getAttribute("data-target");
      if (target) callbacks.current.onLink(target);
      return true;
    });
    function refreshMenu() {
      if (!editor.current || e.view.composing) return;
      const { $from, empty } = e.view.state.selection;
      if (!empty || $from.parent.type.name !== "paragraph") {
        updateMenu(null);
        return;
      }
      const before = $from.parent.textBetween(0, $from.parentOffset);
      const match = /(?:^|\s)\/([^/]*)$/.exec(before);
      if (!match || match[1].length > 40) {
        updateMenu(null);
        return;
      }
      const coords = e.view.coordsAtPos($from.pos);
      updateMenu({
        from: $from.pos - match[1].length - 1,
        to: $from.pos,
        x: Math.min(coords.left, window.innerWidth - 300),
        y: Math.min(coords.bottom + 6, window.innerHeight - 330),
        items: filterEditorSlashItems(match[1]),
        index: 0,
      });
    }
    const key = (event: KeyboardEvent) => {
      const m = menuRef.current;
      if (!m || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        updateMenu(null);
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        updateMenu({
          ...m,
          index:
            (m.index +
              (event.key === "ArrowDown" ? 1 : -1) +
              Math.max(1, m.items.length)) %
            Math.max(1, m.items.length),
        });
      }
      if (event.key === "Enter" && m.items[m.index]) {
        event.preventDefault();
        event.stopPropagation();
        execute(m.items[m.index]);
      }
    };
    e.view.dom.addEventListener("keydown", key, true);
    return () => {
      e.view.dom.removeEventListener("keydown", key, true);
      ime();
      link();
      e.unmount();
      editor.current = null;
    };
  }, []);
  useEffect(() => {
    editor.current?.view.setProps({ editable: () => !disabled });
  }, [disabled]);
  useEffect(() => {
    const e = editor.current;
    if (e && value.trim() !== last.current.trim()) {
      replacing.current = true;
      e.setContent(markdownService.parse(value));
      last.current = value;
      replacing.current = false;
    }
  }, [value]);
  const command = (name: string, args?: unknown) => {
    const e = editor.current;
    if (!e) return;
    e.view.focus();
    const c = (
      e.commands as unknown as Record<string, (args?: unknown) => void>
    )[name];
    c?.(args);
  };
  return (
    <div className="kuku-live-editor">
      <div
        className="kuku-formatbar"
        role="toolbar"
        aria-label="Document formatting"
      >
        {[
          ["Bold", "toggleBold"],
          ["Italic", "toggleItalic"],
          ["Code", "toggleCode"],
          ["Strike", "toggleStrike"],
        ].map(([label, name]) => (
          <button
            key={name}
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => command(name)}
          >
            {label}
          </button>
        ))}
        <span />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("toggleHeading", { level: 2 })}
        >
          H2
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("toggleList", { kind: "bullet" })}
        >
          List
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => command("toggleList", { kind: "task" })}
        >
          Task
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            command("insertTable", { row: 3, col: 3, header: true })
          }
        >
          Table
        </button>
        <span className="format-hint">
          Type / for blocks · [[note]] to link
        </span>
      </div>
      {error && <div role="alert">{error}</div>}
      <div ref={host} />
      {menu && menu.items.length > 0 && (
        <div
          className="kuku-slash-menu"
          role="listbox"
          aria-label="Insert block"
          style={{ left: menu.x, top: menu.y }}
        >
          {menu.items.map((item, i) => (
            <button
              key={item.id}
              role="option"
              aria-selected={i === menu.index}
              className={i === menu.index ? "selected" : ""}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => execute(item)}
            >
              <strong>{item.title}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
