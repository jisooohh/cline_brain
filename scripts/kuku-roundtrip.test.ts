import test from 'node:test';
import assert from 'node:assert/strict';
import { markdownService } from '../src/vendor/kuku/editor';
const source=`---
project: ClineBrain
---

# Kuku editor

한국어 **굵게** *기울임* ~~삭제~~ and \`code\`.

- one
- [ ] unfinished
- [x] finished

> A quote

| Name | Value |
| --- | --- |
| Brain | Local |

\`\`\`typescript
const answer = 42;
\`\`\`

[[ClineBrain project conventions|Project rules]]
`;
test('Kuku conversion preserves rich blocks, tasks, code, frontmatter, wikilinks and Korean',()=>{
 const json=markdownService.parse(source);
 const output=markdownService.stringify(json);
 for(const text of ['한국어','**굵게**','[ ] unfinished','[x] finished','const answer = 42','project: ClineBrain','[[ClineBrain project conventions|Project rules]]']) assert.ok(output.includes(text),text+' missing from '+output);
 assert.match(output,/\| Brain/);
 assert.deepEqual(markdownService.parse(output),json);
});
test('Kuku roundtrip keeps empty paragraphs and nested lists',()=>{
 const doc=markdownService.parse('# One\n\nParagraph\n\n::br\n\n- parent\n  - child\n');
 const out=markdownService.stringify(doc);
 assert.match(out,/::br/);assert.match(out,/child/);assert.deepEqual(markdownService.parse(out),doc);
});
