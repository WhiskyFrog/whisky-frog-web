---
schema: aios.plan/v1
id: simplify-the-public-homepage-frog-presentation-keep-the-frog-ch
project: whisky-frog-web
profile: website
profile_reason: "The requested change is confined to one public webpage's information hierarchy and visual presentation, with explicit responsive, accessibility, navigation, and page-quality requirements. The website profile is narrower than software-feature because no new application behavior, data contract, backend, or API integration is being introduced."
---

# Plan simplify-the-public-homepage-frog-presentation-keep-the-frog-ch

## Brief

Simplify the public homepage frog presentation: keep the frog character imagery as the visual focus, remove the descriptive brand/value/character copy associated with it, retain clear functional navigation to market browsing and direct-price calculation, preserve responsive accessibility, and add or update focused tests. Do not change backend or API behavior.

## Profile Application

The `website` profile is applied at the boundaries relevant to this single
public page:

- **Information architecture.** Reduce `/` to one frog-first presentation with
  two plainly named functional destinations. Remove the marketing narrative,
  value-card, and character-biography layers rather than replacing them with
  new promotional copy. Keep only the concise semantic identification needed
  to name the page and images for assistive technology.
- **Shared visual system.** Reuse the existing public shell, `TopNav`, warm
  palette, focus behavior, character assets, and motion/reduced-motion rules.
  The homepage may adjust its local composition and spacing, but this plan does
  not create a second design system or alter unrelated public pages.
- **Page.** Make the existing Bramble, Cooper, and Pip images the dominant
  homepage content at narrow and wide widths. Retain obvious links to the
  existing market-browsing and direct-price routes without adding a data
  dependency or changing route behavior.
- **Quality checks.** Add focused assertions for retained images and
  destinations, removed descriptive copy, semantic names, keyboard access,
  responsive containment, and reduced-motion compatibility. Run the existing
  type, component, and production-build checks as the integration boundary.

## Assumptions and Risks

- **The homepage is a static presentation boundary.** At planning time
  `app/(home)/page.tsx` renders static content and `next/image`/`next/link`;
  it does not call a backend. The shared `TopNav` independently loads public
  markets. That shell behavior and every API client are outside the homepage
  simplification.
- **All three current frog assets are in scope to retain.** Bramble, Cooper,
  and Pip are rendered from
  `/brand/characters/bramble-preview.png`,
  `/brand/characters/cooper-preview.png`, and
  `/brand/characters/pip-preview.png`. The plan keeps those images as one
  primary composition and removes the later text-only character-card section;
  it does not request new artwork or change asset identity.
- **“Descriptive copy” means the homepage marketing narrative.** The current
  `Whisky Kingdom` eyebrow, slogan, introductory paragraph, three value
  statements, `Royal Tavern` introduction, character roles, and character
  biographies are removed. A concise `Whisky Frog` identifier may remain in
  the shared home link and as the page's accessible heading, because removing
  all naming would weaken navigation and document semantics. It must not grow
  into replacement brand/value copy.
- **The existing functional destinations remain authoritative.** The page
  currently links “마켓 둘러보기” to `/markets/muk` and “직구가 계산하기” to
  `/direct-price`. This plan preserves those destinations and labels. It does
  not invent a market-selection API, change the dynamic `TopNav` market menu,
  or alter either destination page.
- **Visual focus cannot come at the cost of access.** Decorative glow, dust,
  overlap, and motion may remain only when the characters are still legible,
  links have visible focus, content does not clip at supported narrow widths,
  and `prefers-reduced-motion` continues to suppress animation. The character
  names in image alternatives are accessibility labels, not removable
  promotional biographies.
- **Removing sections changes page height and composition.** The revised hero
  must be checked at representative mobile and desktop viewports so the sticky
  navigation, character overlap, and both calls to action remain reachable
  without unintended horizontal scrolling or viewport-height traps.
- **Focused tests should assert user-observable contracts.** Exact Tailwind
  class strings and full-page snapshots would make the tests brittle without
  proving the Brief. Assertions should target landmark/heading semantics,
  image names, link names and destinations, absence of the retired content,
  keyboard focus, overflow, and accessibility results.
- **Backend and API behavior is a hard boundary.** No generated API type,
  fetcher, environment value, route implementation, request fixture, or
  backend-facing test contract needs to change for this static page revision.

## Decomposition Rationale

Two proposals separate the user-facing page outcome from its broader quality
evidence while keeping both small enough for one Worker session.

The first outcome owns the information hierarchy and visual composition. It
removes the existing narrative layers, retains the three established frog
images, and keeps the two task-oriented links usable within the existing
public shell. Its boundary is observable directly from the rendered homepage
and does not require touching data access or destination pages.

The second outcome owns focused regression evidence. It encodes the retained
and removed content contract, checks semantic and keyboard behavior, exercises
representative responsive layouts and reduced-motion handling, and joins that
evidence with the repository's existing type and build checks. Keeping this
boundary explicit prevents a visually plausible edit from being accepted
without proving navigation and accessibility.

No standalone shared-visual-system proposal is needed: the Brief calls for a
narrow simplification, and the relevant palette, shell, image assets, focus
styles, and reduced-motion rules already exist. Their reuse is an acceptance
boundary of the page proposal and a regression boundary of the quality
proposal rather than a new system to design.

## Execution Order

1. task-0009 simplifies the `/` information hierarchy and local layout, preserving
   the existing three-character image composition, accessible identification,
   and functional market/direct-price links while removing the descriptive
   narrative and duplicate character-card content.
2. task-0010 adds the focused semantic, navigation, accessibility, responsive, and
   reduced-motion regression evidence against the simplified page, then runs
   the complete non-backend verification boundary.
