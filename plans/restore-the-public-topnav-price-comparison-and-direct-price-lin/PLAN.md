---
schema: aios.plan/v1
id: restore-the-public-topnav-price-comparison-and-direct-price-lin
project: whisky-frog-web
profile: bug-fix
profile_reason: "The Brief identifies two existing public-UI regressions with directly observable failure states: required TopNav links are hidden below the sm breakpoint, and cask facet groups are exposed by both supported renderers. The bug-fix profile is narrower than website or software-feature because the routes, contracts, navigation destinations, query model, and facet capabilities already exist; the work is to reproduce, correct, and permanently cover those regressions."
---

# Plan restore-the-public-topnav-price-comparison-and-direct-price-lin

## Brief

Restore the public TopNav Price Comparison and Direct Price links at every
viewport, including 320px mobile, without horizontal page overflow. Hide the
three cask-related public facet groups `cask_family`, `cask_type`, and
`cask_material` in both structured v2 `ProductFacetPanel` and legacy
`ProductFacetSidebar` while preserving backend/API/generated types and all
non-cask facets. Add focused regression tests for menu visibility, no overflow,
and cask facet absence.

## Profile Application

The `bug-fix` profile is applied to the two independent public presentation
regressions:

- **Reproduction.** Establish user-observable failures rather than relying on
  Tailwind source inspection alone. At 320px the two destination links inside
  the shared navigation are not visible, while populated cask groups are
  exposed when either the v2 or legacy drawer is opened. Record the focused
  checks failing against the pre-correction behavior.
- **Root cause.** `TopNav` applies `hidden sm:block` directly to both required
  links and its fixed one-row sizing has no narrow-width layout for all public
  controls. `ProductFacetPanel` renders every structured response group
  generically, while `ProductFacetSidebar` has three explicit cask sections.
  Neither renderer currently has a public presentation policy that excludes
  the three cask keys.
- **Correction.** Give the shared navigation a narrow layout in which the
  price-comparison and direct-price anchors remain present, named, focusable,
  and contained. Apply the same explicit cask-key visibility policy at the
  presentation boundary of both facet implementations without deleting the
  corresponding query state or API contract.
- **Regression coverage.** Add role/name/href assertions and real 320px layout
  measurements for the navigation. Exercise both facet implementations with
  non-empty cask data, assert all three cask groups and their options are
  absent, and positively assert representative non-cask groups remain. Join
  the focused checks with the existing type, component, and production-build
  checks.

## Assumptions and Risks

- **The shared component is the correction boundary.** Public routes are
  wrapped by `app/(home)/HomeShell.tsx`, which renders
  `app/components/TopNav.tsx`. Correcting that component restores the links
  across the public shell without duplicating mobile navigation in individual
  pages.
- **The existing labels and destinations are authoritative.** The TopNav
  anchors remain `가격 비교` → `/products` and `직구가 계산` →
  `/direct-price`. Tests scope these names to the navigation landmark so they
  cannot accidentally pass against the homepage's separate
  `직구가 계산하기` call to action.
- **Every viewport means supported narrow through wide layouts.** A real
  320px-wide Chromium viewport is the minimum regression boundary, supplemented
  by a representative intermediate and desktop width. The solution may wrap or
  recompose the navigation at narrow widths, but it may not hide, clip, replace
  with hover-only content, or horizontally scroll the two required anchors.
- **Other TopNav behavior must survive the reflow.** The `Whisky Frog` home
  anchor, market control and menu, and administrator action remain available.
  Their existing market loading, authentication check, login modal, and route
  behavior are not part of this fix. A taller sticky navigation at narrow
  widths is acceptable only if it does not obscure public content.
- **Overflow evidence must measure layout, not class strings.** The browser
  check should compare document `scrollWidth` and `clientWidth`, confirm the
  navigation itself fits the viewport, and confirm each required link has a
  non-zero, in-viewport box. This catches both page overflow and internally
  clipped links.
- **Cask hiding is a public presentation policy, not contract removal.** The
  keys `cask_family`, `cask_type`, and `cask_material` remain in generated
  OpenAPI types, legacy `ProductFilters`, normalized query state, serializers,
  request clients, response fixtures, and backend requests. Existing
  deep-linked values continue to follow current parsing/serialization and can
  still be removed by the global reset; the drawer simply offers no cask group
  or option for new user selection.
- **The v2 and legacy render paths fail differently.** The v2 panel currently
  maps all server groups, so its exclusion must be keyed by the stable group
  key and be independent of label, order, relevance, selection, or option
  count. The legacy sidebar must suppress its three hardcoded sections even
  when the matching axis is enabled and its array is non-empty.
- **All non-cask facets are invariants.** At least representative terms, range,
  selected, and scope-specific groups must remain visible and operable in the
  focused tests. The v2 renderer must remain generic for unfamiliar non-cask
  groups; the existing generic-renderer test that uses a `cask_type` example
  needs a non-cask example so it continues to prove the intended contract
  without contradicting the new public policy.
- **The scope is facet controls only.** Product-card or table metadata that may
  mention cask information, admin whisky/cask management, and backend facet
  generation are not public facet groups and are outside this Brief.
- **Tests must cover both configured client modes without a live backend.**
  Component fixtures should contain unmistakable non-empty data for all three
  cask keys. Browser navigation coverage can extend the existing serverless
  prerendered homepage harness and mock the incidental public-market request.
  No credentials, production data, or persistent server are required.

## Decomposition Rationale

Two proposals match the two independently observable regressions and keep each
correction plus its proof small enough for one Worker session.

The navigation outcome owns one shared-shell layout and its focused component
and browser evidence. It can prove semantic destination links, keyboard
visibility, 320px containment, sticky-layout safety, and wide-layout
preservation without touching product filtering.

The facet outcome owns one public visibility policy applied to both supported
drawers. Fixture-driven component tests can prove all three cask keys are
absent in each mode while non-cask rendering, selection state, request
serialization, generated contracts, and reset behavior remain intact. Keeping
this separate from navigation avoids coupling unrelated UI implementations and
makes a failure identify the affected boundary immediately.

No contract or backend proposal is needed because the Brief expressly
preserves those surfaces. No standalone integration proposal is needed because
each correction carries focused regression evidence, and the final outcome's
repository-wide test and build checks provide the joined integration boundary.

## Execution Order

1. task-0012 restores the two shared TopNav destinations at narrow and wide
   viewports, demonstrates the pre-correction mobile visibility failure, and
   adds semantic and measured 320px overflow regression coverage.
2. task-0013 applies the cask visibility policy to the structured v2 and legacy
   facet drawers, demonstrates the populated-fixture failure, adds positive
   non-cask and negative cask assertions for both modes, and finishes with the
   repository-wide test and production-build checks as the combined
   integration boundary.
