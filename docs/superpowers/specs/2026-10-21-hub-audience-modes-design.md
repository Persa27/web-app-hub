# Hub audience modes design

**Date:** 2026-10-21
**Status:** Conversational design approved; written-spec review pending

## Goal

Give the Hub two clear ways to browse its catalog: a child-oriented view and a complete view. The child view must contain only appropriate works and every text exposed in that mode must be child-friendly and free of kanji. The complete view must use adult-oriented Japanese copy with kanji for every card, including cards for child-oriented works.

The change is limited to the Hub. The applications themselves, their URLs, and their in-app copy do not change.

## Audience classification

Each catalog entry receives one audience value:

| Audience | Works | Child view |
| --- | --- | --- |
| `child` | ballrace, mogumon, fossil-excavation, math-marathon, quiz-zukan, shatepon | Included |
| `family` | treasure (AR宝さがし) | Included for shared adult-child use |
| `general` | sock-pair, chimo, triad-io, sentinel-blacklist | Excluded |

The four general-audience entries are 靴下神経衰弱, チモレース, TRIAD.io, and SENTINEL. The child view therefore contains seven works; the complete view contains all eleven.

## Mode selection and catalog behavior

Add an accessible two-button mode selector above the existing category filters. Its labels are mode-specific so that even the inactive button has no kanji in child mode:

| Page mode | Complete-catalog button | Child-view button |
| --- | --- | --- |
| Child | 「ぜんぶ」 | 「こどもむけ」 |
| Complete | 「すべて表示」 | 「子ども向け表示」 |

- The complete mode is selected on every fresh page load. Mode choice is not saved between page loads.
- Switching modes preserves the selected category filter and sort option.
- Keep the current published and development sections. Apply the audience filter to both sections, so excluded works cannot appear under development either.
- Keep the current category-filter scope: category buttons filter the published section as they do today. The mode filter applies to both sections.
- Keep the current count semantics: the category total and result count describe matching published works; development works remain in their separate section and are not added to those counts. The “coming soon” card is not counted as a work.
- Keep the default compound sort (updated date descending, then upload date descending, then page views descending), other sort choices, page-view fetch, and open-in-new-tab behavior.
- The existing “coming soon” card remains a non-catalog placeholder in the published section in both modes and uses mode-appropriate copy.

The selected mode is reflected through button styling and `aria-pressed`. Mode changes update card visibility, section visibility, and published-work counts. The complete mode is also the no-JavaScript fallback; operating the child mode requires JavaScript.

## Copy and catalog data

Keep one catalog in `apps.json`. Add an audience field and a pair of complete card-copy variants to every app:

- `copy.children`: child-facing text with no kanji.
- `copy.all`: adult-facing text using kanji.

Each variant supplies the display name, kana reading, description, tags, image alternative text, and app-specific note. The child variant uses kana names where the canonical name contains kanji, including 「かせきはっくつ」 and 「ARたからさがし」. In the complete mode, all cards use their adult variant, including child-audience cards.

Keep shared Hub labels for the two modes together in a mode-copy map. It covers visible page chrome and text exposed to assistive technology: document title and description, navigation and headings, instructions, mode/category/sort controls, result count, status badges, metadata labels, parent-information and privacy sections, footer labels, and link/accessibility labels. Mode-control button labels themselves use the table above. Development-state notices also vary by mode.

In child mode, every displayed text and accessibility label across the Hub uses child-facing copy and contains no Han-script characters. This includes headings, controls (including the inactive mode button), metadata, app names, descriptions, tags, image alt text, links, document title/description, and shared page sections. In complete mode, all those surfaces use the adult-facing variant. Images and the applications themselves are outside this text rule.

The existing static no-JavaScript fallback remains fixed in the complete mode. It keeps its current links, including the cut-balance link, which is outside this migration.

## Acceptance criteria

1. On a fresh load, the complete mode is selected and the catalog contains all eleven works in their existing published/development sections.
2. Selecting child mode leaves exactly seven catalog works: the six child-audience works and AR宝さがし. The four general-audience works are absent from both sections.
3. Switching between modes changes the common Hub copy and every visible card-copy field to the selected mode. Switching back restores the complete copy.
4. A rendered child-mode text inventory, including both mode buttons, accessibility labels, and image alt text, contains no Han-script characters. Its copy reads naturally for children. Complete-mode copy is adult-oriented and uses kanji throughout the Hub copy surfaces.
5. A mode change preserves the current category and sort selection, maintains published/development grouping, and updates visibility and published-work counts without counting the coming-soon card or development works.
6. Existing sort modes and default priority, page-view values, app links, and new-tab behavior remain intact.
7. Catalog tests cover audience classification, exact mode membership, both copy variants, the child-mode no-kanji rule, default mode, and mode-switch behavior.

## Out of scope

- Changes to any application's source, in-app text, deployment, or URL.
- Changes to page-view collection or its historical counts.
- Changes to category-filter scope, sort definitions, or the no-JavaScript fallback links.
