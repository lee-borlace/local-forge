---
name: localforge-navigation
description: Find relevant source with symbol-first, bounded code navigation.
---
1. Identify the likely subsystem via glob/grep or Serena symbol search.
2. For source, inspect symbol outlines and retrieve only relevant bodies. Use references for callers and implementations. If Serena cannot resolve a language, use native grep and bounded read with offset/limit.
3. Expand only when evidence warrants it. Do not re-read unchanged information. Respect repository instructions and Unity serialized assets that may not appear in code references.
4. Use native targeted edit or patch, preserving unrelated code. Re-read the target if an edit fails or the source changes.
