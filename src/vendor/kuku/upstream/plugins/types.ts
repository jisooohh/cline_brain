import type { Root } from "mdast";
import type { RemarkPlugin } from "../lib/markdown/processor";
import type { MdastToPmBlockHandler, MdastToPmInlineHandler, PmToMdastBlockHandler, PmToMdastInlineHandler, PmToMdastMarkHandler } from "../lib/markdown/types";
export type Disposer = () => void;
export interface MarkdownContribution {
  /** Additional remark plugins for parsing/stringifying custom syntax. */
  remarkPlugins?: RemarkPlugin[];
  /**
   * Optional mdast tree transforms applied around the conversion pipeline.
   *
   * - `afterParse`  — runs on the mdast tree **after** remark parses the
   *   markdown string, **before** mdast → PM conversion.
   * - `beforeStringify` — runs on the mdast tree **after** PM → mdast
   *   conversion, **before** remark serialises back to markdown.
   */
  mdastTransform?: {
    afterParse?: (tree: Root) => Root;
    beforeStringify?: (tree: Root) => Root;
  };
  /** mdast → PM JSON handlers. */
  mdastToPm?: {
    block?: Record<string, MdastToPmBlockHandler>;
    inline?: Record<string, MdastToPmInlineHandler>;
  };
  /** PM JSON → mdast handlers. */
  pmToMdast?: {
    block?: Record<string, PmToMdastBlockHandler>;
    inline?: Record<string, PmToMdastInlineHandler>;
    mark?: Record<string, PmToMdastMarkHandler>;
  };
}
