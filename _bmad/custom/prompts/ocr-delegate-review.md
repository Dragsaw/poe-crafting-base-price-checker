# OCR delegate review

Invoke the `open-code-review:delegate-review` skill and follow it, with these changes:

- The parent chose the diff. Do not run `ocr delegate preview`. The files to review are the `+++ b/<path>` paths in the diff file. Review the hunks in the diff file, not a new `git diff`.
- If the parent gives a spec path, read the spec as background. Do not audit the diff against its acceptance criteria. Another layer does that. If the spec path is empty, there is no spec. Do not look for one.
- Do not do Step 4, except that you still leave out the findings it calls Low. Do not edit files or apply fixes, and do not give severities. Report each finding with its file and line, the OCR rule, the bad outcome, and the smallest fix. After the findings, add the coverage line.
- Do not start a subagent.

Return the findings as text in your final message. Do not send them through a findings-reporting tool.
