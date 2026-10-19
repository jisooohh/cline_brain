// Kuku's editor schema and Markdown service, hosted by React instead of Solid.
import {
  createEditor,
  defineBaseKeymap,
  defineHistory,
  defineDocChangeHandler,
  defineKeymap,
  union,
} from "prosekit/core";
import { defineDoc } from "prosekit/extensions/doc";
import { defineParagraph } from "prosekit/extensions/paragraph";
import { defineText } from "prosekit/extensions/text";
import { toggleMark } from "prosekit/pm/commands";
import { defineEditorCoreExtension } from "./upstream/plugins/builtin/core_editor";
import { editorCoreMarkdown } from "./upstream/plugins/builtin/core_editor/markdown_handlers";
import { defineWikilink } from "./upstream/plugins/builtin/wikilink/nodes/wikilink";
import { wikilinkMarkdown } from "./upstream/plugins/builtin/wikilink/markdown_handlers";
import {
  contributeMarkdown,
  buildMarkdownService,
  getMarkdownService,
} from "./upstream/plugins/markdown_service";
import { defineBlurSelection } from "./upstream/components/editor/system/blur_selection";
import { defineDocumentChangeOrigin } from "./upstream/plugins/editor_change_origin";
contributeMarkdown("core-editor", editorCoreMarkdown);
contributeMarkdown("wikilink", wikilinkMarkdown);
buildMarkdownService();
export const markdownService = getMarkdownService()!;
export function createDocumentEditor(
  value: string,
  onChange: (value: string) => void,
) {
  return createEditor({
    extension: union(
      defineDoc(),
      defineText(),
      defineParagraph(),
      defineHistory(),
      defineBaseKeymap(),
      defineBlurSelection(),
      defineDocumentChangeOrigin(),
      defineEditorCoreExtension(),
      defineWikilink(),
      defineKeymap({
        "Mod-b": (state, dispatch) =>
          toggleMark(state.schema.marks.bold)(state, dispatch),
        "Mod-i": (state, dispatch) =>
          toggleMark(state.schema.marks.italic)(state, dispatch),
        "Mod-e": (state, dispatch) =>
          toggleMark(state.schema.marks.code)(state, dispatch),
      }),
      defineDocChangeHandler((view) =>
        onChange(markdownService.stringify(view.state.doc.toJSON())),
      ),
    ),
    defaultContent: markdownService.parse(value),
  });
}
