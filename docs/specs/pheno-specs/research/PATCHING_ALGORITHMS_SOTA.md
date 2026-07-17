# State of the Art: Code Patching and Diffing Algorithms

## Executive summary

This research note summarizes the patching and diffing algorithms most relevant to
phenotype-patch. The main decision point is not only edit distance, but also human-readable output
and reliable merge behavior.

## Core algorithms

- Myers diff is the foundational shortest-edit-script algorithm used by Git and many diff tools.
- Patience diff improves readability by preferring unique lines and falling back to Myers where
  needed.
- Histogram diff extends patience-style matching with frequency-based heuristics and is commonly
  used for code because it balances readability and performance.

## Merge and patch application

- Diff3 and recursive three-way merge are the common building blocks for merge tools.
- Fuzzy patch application is useful when line numbers drift but surrounding context still matches.
- Octopus merge is relevant when multiple branches must be merged together, but it is not the
  default choice for interactive patching workflows.

## Specialized approaches

- AST-based diffing is better for syntax-aware changes in structured languages.
- Semantic diffing is useful when line-by-line comparison is too noisy.
- Binary diffing is the right choice for non-text artifacts.

## Practical guidance

1. Use Myers-style algorithms for minimal edit scripts and general-purpose patching.
2. Prefer patience or histogram diff when code readability matters more than strict minimality.
3. Use AST or semantic approaches when source structure is more important than raw text.
4. Keep patch application resilient with context checking and clear failure reporting.

## Recommendation

For phenotype-patch, the best default is a histogram-style or patience-style text diff with fuzzy
patch application and a fallback path for noisy or highly repetitive files.
