import { FileText } from "lucide-react";
import type { BrainItem } from "./types";
export default function DocumentInspector({
  body,
  title,
  id,
  items,
  onOpen,
}: {
  body: string;
  title: string;
  id?: string;
  items: BrainItem[];
  onOpen: (item: BrainItem) => void;
}) {
  const headings = [...body.matchAll(/^(#{1,6}) (.+)$/gm)];
  const backlinks = items.filter(
    (item) =>
      item.id !== id &&
      [...item.body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].some(
        (m) => m[1].replace(/\.md$/, "").toLowerCase() === title.toLowerCase(),
      ),
  );
  return (
    <aside className="document-inspector">
      <h3>Outline</h3>
      {headings.map((m, i) => (
        <button
          key={i}
          style={{ paddingLeft: (m[1].length - 1) * 9 + 10 }}
          onClick={() => {
            const nodes = document.querySelectorAll(
              ".kuku-live-editor .ProseMirror :is(h1,h2,h3,h4,h5,h6)",
            );
            Array.from(nodes)
              .find((h) => h.textContent === m[2])
              ?.scrollIntoView({ block: "center", behavior: "smooth" });
          }}
        >
          {m[2]}
        </button>
      ))}
      {!headings.length && <p>Add a heading to outline your document.</p>}
      <h3>
        Backlinks <small>{backlinks.length}</small>
      </h3>
      {backlinks.map((item) => (
        <button key={item.id} onClick={() => onOpen(item)}>
          <FileText size={12} />
          {item.title}
        </button>
      ))}
      {!backlinks.length && <p>No linked mentions yet.</p>}
      <h3>Connections</h3>
      <p>Type [[document title]] to connect your notes.</p>
    </aside>
  );
}
