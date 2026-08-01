# Sample pending file

Fictional, and written against Section 13 of the document, which is the Open Questions
section and therefore harmless to write to.

`context-add.txt` exercises the ADD path. The Information Extractor reads the action,
the section number and the new text. Build Replacement turns those into a search string
and a replacement string. An ADD searches for the section anchor token and replaces it
with the new paragraph followed by the same token, so the anchor survives and the next
ADD still has something to find.

The file deliberately carries no anchor token in its body. A sample containing a literal
anchor would teach anyone copying it to write a second one into the document, which
breaks the invariant every future ADD depends on.
 
