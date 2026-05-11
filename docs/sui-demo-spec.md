# Sui Salon Demo - Spec

## Summary

A standalone interactive demo page for `salon sui`, a private facial salon near Osaka Uehonmachi Station. The page should turn the existing flyer material into a polished web experience while keeping the source identity intact: quiet, refined, Japanese, skincare-focused, and reservation-led.

The demo lives at `/sui-demo` and includes a visible design switcher that changes between four complete visual treatments. All four designs use the same base content and interactions, but each changes layout, hierarchy, atmosphere, and motion.

No backend is required. Contact, reservation, QR, and consultation flows are mocked client-side.

## Route

`/sui-demo`

Design switching is query-param driven:

- `/sui-demo` -> default design, `botanical-flyer`
- `/sui-demo?design=botanical-flyer`
- `/sui-demo?design=soft-spa-menu`
- `/sui-demo?design=consultation-studio`
- `/sui-demo?design=reservation-concierge`

Unknown design values fall back to `botanical-flyer` and replace the URL with the sanitized value.

## Source Assets

Use the existing source files without moving them:

| Asset | Purpose |
| --- | --- |
| `/sui/sui pamphlet.jpg` | Primary blue botanical flyer source, matching Image #1 |
| `/sui/sui pamphlet 2.jpg` | Warm minimal treatment menu source, matching Image #2 |
| `/sui/sui 1.png` | Salon mark, "salon sui - 美肌再生ラボ - Mihoko Sakaki" |
| `/sui/sui 2.png` | Instagram QR, LINE QR, simple access map, address, hours |
| `/sui-logo.svg` | Extracted geometric salon mark for clean UI placement |

The full flyer images should be available in an "Originals" or "Source" viewer inside the demo so the user can compare each web design against the supplied print material.

## Brand And Content Base

### Brand

- Name: `salon sui`
- Descriptor: `美肌再生ラボ`
- Primary Japanese positioning: `上本町の肌質改善フェイシャルサロン`
- Treatment focus: electroporation/exosome introduction care
- Reservation model: by appointment only
- Location: Osaka Uehonmachi, 3 minutes on foot
- Hours: 10:00-22:00
- Instagram: `@sui.bihadalabo`

### Core Message

Use this as the shared intro copy:

`エレクトロポレーション導入で、うるおい・ツヤ感・キメを整えるケア。肌状態を確認し、お悩みに合わせて施術をご提案します。`

For the treatment menu context:

`美容成分を肌の深部へ届け、うるおいと透明感のある肌へ。`

Footnote:

`※角質層まで`

### Trust Points

These appear in every design, though the treatment differs visually:

- `完全予約制でゆったり施術`
- `大阪上本町駅 徒歩3分`
- `10:00-22:00 営業`

### Concerns

The concern selector should appear in every design:

- `乾燥`
- `くすみ印象`
- `ハリ不足`
- `キメの乱れ`
- `手元の乾燥`

Selecting a concern highlights the recommended course and updates a short recommendation note.

### First-Time Offer

Use this as the featured introductory offer:

- Label: `初めての方へ`
- Ribbon: `はじめての方におすすめ`
- Title: `初回カウンセリング付き エクソソーム導入体験`
- Duration: `45分`
- Price: `¥8,800`
- Note: `肌状態を確認し、お悩みに合わせて施術をご提案します。`

### Services

| ID | Name | Ingredient | Description | Duration | Price |
| --- | --- | --- | --- | --- | --- |
| `high-exosome` | `高濃度エクソソームコース` | `ヒト幹美容液＋化粧水` | `うるおいやハリを与え、輝くような肌へ導きます。` | `30分` | `¥10,000` |
| `premium-exosome` | `超濃度エクソソームコース` | `ヒト幹美容液＋美容液` | `年齢肌や乾燥が気になる方に。弾むような肌へ。` | `30分` | `¥12,000` |
| `hand-care` | `手の甲エクソソームコース` | `美容液` | `手元のハリ・透明感ケアに。若々しい印象の手肌へ。` | `10分` | `¥5,500` |

If using the wording from Image #1 for the first course in a broader skin-improvement context, `肌質改善エクソソーム導入コース` is acceptable as an alternate display title for `high-exosome`.

### Options

| ID | Name | Duration | Price |
| --- | --- | --- | --- |
| `moisture-pack` | `保湿パック` / `パック` | `10分` | `¥2,000` |
| `eyebrow-cut` | `眉毛カット` | `30分` | `¥2,200` |

### Access

- Address: `大阪市天王寺区上本町6-9-19 FLAT34 703`
- Hours: `OPEN 10:00-22:00`
- Reservation: `完全予約制`
- Nearby markers from the source access card: `大阪上本町駅`, `ハイハイタウン`, `徒歩3分`

## Suggested File Structure

Use a self-contained route structure similar to the existing demo routes:

```text
src/app/sui-demo/
  page.tsx
  SuiDemo.tsx
  sui-demo.module.css
  data.ts
  types.ts
  utils.ts
  components/
    DesignSwitcher.tsx
    SourceViewer.tsx
    TrustStrip.tsx
    ConcernSelector.tsx
    ServiceCard.tsx
    ReservationDrawer.tsx
    ContactPanel.tsx
```

Recommended page setup:

- `page.tsx` is a server component with metadata and Japanese-capable fonts.
- `SuiDemo.tsx` is a client component that reads and writes `design` through `useSearchParams` and `useRouter`.
- `sui-demo.module.css` owns all route-specific styling and theme tokens.
- `data.ts` contains all Japanese copy, service details, design metadata, recommendation mappings, and asset paths.

## Typography

The experience is Japanese-first. Use Japanese font families instead of relying only on Latin serif/sans fonts.

Recommended:

- Display serif: `Noto Serif JP`, fallback `serif`
- Body sans: `Noto Sans JP`, fallback `system-ui, sans-serif`
- Accent Latin for `sui`: a restrained italic serif if available, otherwise inherit from the display serif

Typography requirements:

- Do not scale fonts directly with viewport width.
- Keep Japanese display copy generous but controlled; avoid oversized text inside cards and compact controls.
- Letter spacing should be `0` by default. If Japanese headings need tracking, keep it subtle and localized to headings only.
- Validate mobile line breaks for long Japanese strings such as `初回カウンセリング付き エクソソーム導入体験`.

## Base Interaction Requirements

### Design Switcher

The switcher is required and appears in all designs.

Behavior:

- A segmented control with four options.
- Desktop placement: sticky top toolbar, aligned to the page content width.
- Mobile placement: horizontally scrollable segmented control below the compact header.
- Each option has a short label and a tiny visual swatch.
- Click updates `?design=...` with `router.push` so browser back and forward work.
- Keyboard shortcuts `1`, `2`, `3`, `4` switch designs when focus is not in an input.
- Active option uses `aria-pressed="true"` or `aria-current="true"`.
- Design transition uses a 220-300ms crossfade and slight vertical motion.
- Respect `prefers-reduced-motion` by disabling parallax, counting animations, and transition movement.

Design labels:

- `Botanical Flyer`
- `Soft Spa Menu`
- `Consultation Studio`
- `Reservation Concierge`

### Concern Recommendation

Selecting a concern updates the recommended service:

| Concern | Recommendation |
| --- | --- |
| `乾燥` | `premium-exosome` plus `moisture-pack` |
| `くすみ印象` | `high-exosome` |
| `ハリ不足` | `premium-exosome` |
| `キメの乱れ` | `high-exosome` |
| `手元の乾燥` | `hand-care` plus `moisture-pack` |

The recommendation should visibly affect the UI:

- Highlight the matching service card.
- Update a compact note: `このお悩みには「...」がおすすめです。`
- In calculator-style designs, preselect the matching course and option.

### Service Details

Each service card is interactive:

- Default state shows name, ingredient, duration, and price.
- Expanded state shows description, ideal concerns, and suggested option.
- Only one service needs to be expanded at a time on mobile.
- Desktop can allow multiple expanded cards if the layout supports it cleanly.

### Reservation Drawer

Clicking any reservation CTA opens a drawer or modal.

Content:

- Selected service and options
- Total duration and total price
- Contact method tabs: `LINE`, `Instagram`
- QR image area using `/sui/sui 2.png`
- Copyable Instagram handle
- Address and hours
- Note: `ご相談だけでも歓迎です。お気軽にお問い合わせください。`

The drawer is a demo-only contact surface; it does not submit to a backend.

### Add-On Calculator

Where space allows, options can be toggled:

- Toggle `パック`
- Toggle `眉毛カット`
- Recalculate total duration and price
- Display a small summary: `合計 40分 / ¥12,000` etc.

### Source Viewer

Include a source viewer so the user can inspect the original materials:

- Button label: `Source`
- Desktop: side sheet with tabs for Image #1, Image #2, logo/access cards
- Mobile: full-screen modal
- Use `next/image` with the actual public paths
- Do not make the full flyer screenshots the only UI; they are references and optional comparison panels

## Base Page Sections

Every design should include these content sections, though order and layout can vary:

1. Header with logo, name, design switcher, reservation CTA
2. Hero or first viewport with clear salon positioning
3. Trust points
4. Concern selector
5. First-time offer
6. Service menu
7. Options
8. Reservation/contact panel
9. Access panel
10. Source viewer

## Shared Visual Constraints

- Avoid a generic landing page. The first viewport must immediately feel like a usable salon menu or consultation interface.
- Use real source assets: logo, QR/access image, and original flyer references.
- Keep cards at `8px` radius or less unless recreating the soft source-menu sheet, where `12px` is acceptable for image wells.
- No nested cards.
- No decorative gradient orbs or unrelated bokeh backgrounds.
- Do not use a one-note palette. Each design can have a dominant direction, but it needs secondary accents and sufficient neutral contrast.
- The QR/access content must remain readable. If using `/sui/sui 2.png` inside a small panel, provide a click-to-enlarge state.
- All CTAs and controls need focus-visible states.

## Design 1: Botanical Flyer

ID: `botanical-flyer`

Source basis: Image #1, `/sui/sui pamphlet.jpg`

### Intent

Translate the ornate blue flyer into a responsive interactive poster. This version should feel closest to the original print design: refined navy typography, watercolor leaves, thin gold dividers, framed offer area, compact menu rows, and an emphatic LINE/Instagram reservation block.

### Palette

- Deep salon navy: `#0b3d78`
- Ink blue: `#143b65`
- Watercolor blue: `#dcebf8`
- Soft leaf blue: `#8fb4d4`
- Antique gold: `#b38a3b`
- Paper white: `#fffdf8`
- Hairline gray-blue: `#d8e2ec`

### Layout

Desktop:

- Centered poster-like page with max width around `1120px`.
- Header places the logo mark above the large Japanese headline.
- Trust points are three equal columns with icon medallions.
- Concern selector is a row of outlined pills.
- First-time offer is a full-width framed ticket with corner flourishes and a strong `45分 / ¥8,800` price split.
- Regular menu is a compact numbered list with duration badges and large right-aligned prices.
- Bottom area is a three-column footer: reservation CTA, QR panel, access panel.

Mobile:

- Preserve the poster rhythm as stacked blocks.
- Trust points become horizontally swipeable tiles.
- Bottom contact and access panels stack, with QR/access image expandable.

### Visual Details

- Use the extracted logo `/sui-logo.svg` or `/sui/sui 1.png` at the top.
- Botanical decoration should be CSS/background-image based where possible. The full flyer can be softly ghosted at the edges only if it does not reduce legibility.
- Thin dividers and small ornament rules should echo the source flyer, but avoid overbuilding decorative SVGs.
- Icon medallions can use existing icon components for face, map pin, clock, droplet, scissors, and calendar.

### Interactions

- Hovering a concern pill lightly lifts it and reveals the recommended course.
- The offer ticket has a subtle shimmer on the gold price when first scrolled into view.
- Menu rows expand inline.
- Reservation block opens the reservation drawer with `LINE` as the default tab.
- The contact footer can toggle between `QR` and `Access` on narrow screens.

### Motion

- Slow leaf/parallax drift at the top corners on desktop only.
- Menu rows stagger in with a short fade.
- Design-switch transition feels like turning to a new flyer sheet.

## Design 2: Soft Spa Menu

ID: `soft-spa-menu`

Source basis: Image #2, `/sui/sui pamphlet 2.jpg`

### Intent

Create a calm treatment-menu page inspired by the warm, minimal second flyer. This design should feel like a quiet spa pricing menu: soft natural light, ivory paper, beige accents, fine gray dividers, circular treatment illustrations, and generous breathing room.

### Palette

- Warm ivory: `#fbf8f1`
- Porcelain: `#fffdf9`
- Taupe shadow: `#d8cfc2`
- Soft beige chip: `#eee5dc`
- Botanical sage: `#6f816d`
- Charcoal ink: `#343434`
- Sui navy accent: `#153d63`

### Layout

Desktop:

- Full page background uses warm paper and soft angled shapes inspired by the curved white sheet in Image #2.
- Top hero is centered: title, short rule, subtitle, footnote.
- Main menu is a large white sheet with three horizontal course rows.
- Each row has a circular media well on the left, copy in the center, price and duration on the right.
- Option panel sits below as a framed compact table with dotted leaders.
- Contact/access panel appears as a quiet bottom band, not a heavy CTA block.

Mobile:

- Course rows become stacked cards with the price and duration side by side below the copy.
- The option panel remains compact, using two rows.
- Source viewer and reservation CTA sit in a sticky bottom bar.

### Visual Details

- Use large soft shadows, but keep them low contrast.
- Add small botanical sprig accents around the menu sheet using CSS masks or existing source imagery crops only if they remain subtle.
- Course icons should map to the source flyer:
  - Droplet/glow for `高濃度エクソソームコース`
  - Serum bottle for `超濃度エクソソームコース`
  - Hand/sparkle for `手の甲エクソソームコース`
- Use fine `1px` dividers between service rows.

### Interactions

- Hover/focus on a course row expands a detail panel under that row.
- Selecting a concern scrolls or focuses the recommended row with a soft beige highlight.
- Options use small toggle chips integrated into the framed option panel.
- Reservation drawer opens from the right on desktop and bottom on mobile.

### Motion

- Use very restrained motion: fade, slight scale, and soft shadow changes.
- No heavy parallax. A subtle light sweep over the paper background is acceptable if reduced-motion support disables it.

## Design 3: Consultation Studio

ID: `consultation-studio`

Source basis: Image #1 concern flow plus Image #2 treatment clarity

### Intent

Turn the flyer content into a premium interactive consultation tool. This design is less poster-like and more productized: the visitor selects concerns, intensity, and treatment goals, then the UI recommends a course and add-ons. It should feel like a high-end salon intake experience, not a medical dashboard.

### Palette

- Clean white: `#ffffff`
- Mist blue: `#eef6fb`
- Sui blue: `#1f6da5`
- Deep ink: `#1f2f3d`
- Soft mint: `#dcebe3`
- Pale gold: `#d9bf75`
- Cool border: `#d9e5ee`

### Layout

Desktop:

- Split first viewport.
- Left side: consultation controls with concern chips, intensity segmented control, skin goal tabs, and time preference.
- Right side: live recommendation panel with selected course, add-ons, total duration/price, and reservation CTA.
- Below: treatment menu as supporting evidence, then access/contact.

Mobile:

- A stepper replaces the split layout:
  1. `お悩み`
  2. `肌状態`
  3. `おすすめ`
  4. `予約`
- Sticky progress indicator at the top.
- Recommendation card remains sticky at the bottom after a course is selected.

### Components

- `ConsultationStepper`
- `ConcernMatrix`
- `RecommendationPanel`
- `SkinLayerDiagram`
- `PlanSummary`

### Interaction Details

- Concern selector supports one primary concern and optional secondary concerns.
- Intensity values: `気になる`, `かなり気になる`, `集中的にケアしたい`
- Goal tabs:
  - `うるおい`
  - `ツヤ感`
  - `ハリ`
  - `透明感`
  - `手元ケア`
- The recommendation updates immediately as inputs change.
- The `SkinLayerDiagram` visually shows `美容成分 -> 角質層まで` as a tasteful animated layer graphic. Keep the language cosmetic and avoid medical claims.
- "Why this plan" accordion explains the recommendation in one or two sentences.

### Recommendation Logic

Base mapping:

- Primary `手元の乾燥` always recommends `hand-care`.
- Any high intensity selection for `乾燥` or `ハリ不足` recommends `premium-exosome`.
- `くすみ印象` or `キメの乱れ` at normal intensity recommends `high-exosome`.
- `乾燥` plus any facial concern adds `moisture-pack`.
- Time preference under `30分` disables add-ons by default.

### Visual Details

- Use more geometric rhythm from the salon logo: translucent triangular overlays, diagonal separators, and light blue glass panels.
- Keep the UI dense enough to feel like an actual tool, but leave whitespace around Japanese text.
- Course cards are compact and scannable, with one primary blue accent.

### Motion

- Recommendation panel animates number changes for price and duration.
- The layer diagram animates once on first view, then stops.
- Step transitions slide horizontally on mobile.

## Design 4: Reservation Concierge

ID: `reservation-concierge`

Source basis: Image #1 contact/footer emphasis plus Image #2 calm pricing menu

### Intent

Make reservation the primary experience. This design should feel like a refined booking concierge: choose a course, add options, pick a contact channel, review access, and open LINE/Instagram QR. It is still a demo, but the workflow should feel immediately usable.

### Palette

- Midnight navy: `#073c74`
- Reservation blue: `#0d5e9d`
- Paper white: `#fffdfa`
- Soft cream: `#f7f1e8`
- Gold: `#bd9a4a`
- Pale blue gray: `#e7eff6`
- Ink: `#15283a`

### Layout

Desktop:

- Two-column app-like layout.
- Left column: service and option selector.
- Right column: sticky reservation summary with total, contact method, QR/access preview, and CTA.
- A slim top hero introduces `salon sui` and the Uehonmachi positioning without taking over the screen.
- The original flyer source appears as a collapsible reference panel near the bottom.

Mobile:

- Booking-first vertical flow:
  1. Choose concern
  2. Choose course
  3. Add options
  4. Contact
- Sticky bottom summary with total and `予約・相談する`.

### Components

- `BookingBuilder`
- `CoursePicker`
- `OptionToggles`
- `ContactMethodTabs`
- `AccessPreview`
- `StickyBookingSummary`

### Interaction Details

- Selecting a concern preselects the recommended course.
- Selecting a course shows a short "best for" note.
- Option toggles update totals instantly.
- Contact tabs:
  - `LINE`: shows the LINE QR area from `/sui/sui 2.png`
  - `Instagram`: shows `@sui.bihadalabo` and the Instagram QR area
  - `Access`: shows address, hours, and source map image
- The final CTA opens a confirmation modal:
  - Title: `ご予約・ご相談`
  - Summary: selected plan, total duration, total price
  - Message: `LINEまたはInstagramからお問い合わせください。`
- Include copy buttons for address and Instagram handle.

### Visual Details

- Use a stronger navy reservation panel inspired by the bottom block in Image #1.
- Gold rules and small corner details can frame the summary, but keep controls modern.
- Course picker cards should use the softer row structure from Image #2 so the page does not become too heavy.

### Motion

- Total price and duration count up/down when choices change.
- Sticky summary pulses once when a recommendation changes.
- QR panel crossfades when switching contact tabs.

## Design Switcher Implementation Notes

Suggested design metadata:

```ts
export const designs = [
  {
    id: 'botanical-flyer',
    label: 'Botanical Flyer',
    swatch: ['#0b3d78', '#dcebf8', '#b38a3b'],
    source: '/sui/sui pamphlet.jpg'
  },
  {
    id: 'soft-spa-menu',
    label: 'Soft Spa Menu',
    swatch: ['#fbf8f1', '#6f816d', '#153d63'],
    source: '/sui/sui pamphlet 2.jpg'
  },
  {
    id: 'consultation-studio',
    label: 'Consultation Studio',
    swatch: ['#ffffff', '#1f6da5', '#dcebe3'],
    source: '/sui/sui pamphlet.jpg'
  },
  {
    id: 'reservation-concierge',
    label: 'Reservation Concierge',
    swatch: ['#073c74', '#fffdfa', '#bd9a4a'],
    source: '/sui/sui 2.png'
  }
] as const
```

Switcher rules:

- The selected design adds a design-specific class to the route root, for example `styles.botanicalFlyer`.
- Shared components receive `variant` only when markup genuinely differs.
- Prefer CSS custom properties for palette and spacing differences.
- Use separate presentational sections for designs whose layouts are materially different, but keep data and interaction state shared.

## Accessibility

- Japanese page language should be set with `lang="ja"` on the route root if the global app remains English.
- All icon-only buttons need accessible labels.
- The design switcher must be keyboard accessible.
- Drawer/modal focus should trap while open and restore focus on close.
- QR images need descriptive alt text.
- Color contrast should pass WCAG AA for body text and controls.
- Motion must respect `prefers-reduced-motion`.

## Responsive Acceptance Criteria

Validate at:

- 390px wide mobile
- 768px tablet
- 1280px desktop
- 1440px desktop

Required:

- No Japanese text overlaps or clips.
- Design switcher remains reachable and does not cover important content.
- QR/access source image is readable after opening the enlarged view.
- First-time offer price and duration remain legible.
- Course rows/cards remain stable when expanded.
- Sticky reservation summary does not hide form controls on mobile.

## QA Checklist

- `/sui-demo` loads without console errors.
- All four designs can be selected from the switcher.
- Direct URLs with `?design=...` load the correct design.
- Browser back/forward works across design changes.
- Concern selection updates recommendation and highlighted course.
- Service cards expand and collapse.
- Option toggles update duration and price where implemented.
- Reservation drawer/modal opens from every CTA and can be closed with Escape.
- Source viewer displays all four source assets.
- Images render through `next/image` or a consistent local image component.
- Reduced-motion mode disables parallax and large movement.

## Implementation Priority

1. Build shared data, route shell, design switcher, and source viewer.
2. Implement shared service, concern, option, reservation, and access interactions.
3. Build `botanical-flyer` and `soft-spa-menu` first because they map directly to the supplied visuals.
4. Build `consultation-studio` and `reservation-concierge` using the same data and interaction state.
5. Run responsive checks and tune Japanese line breaks before final polish.

---

## Critical Areas for Improvement

### Current State Assessment

The existing implementation functions correctly but diverges significantly from the refined aesthetic of the source pamphlets. The demo currently feels like a **"web app with design variants"** rather than **"four digital translations of refined print salon materials."** All four designs share too much structural DNA—same button patterns, same card hierarchies, same interaction models—resulting in color-swapped variations of a single template instead of four genuinely distinct design languages.

### 1. Design Differentiation and Visual Identity

**Issue:** All four designs use identical component patterns (same buttons, same borders, same hover effects, same card structures). The design switcher is too prominent and "tech demo"-like, constantly reminding the user they're viewing a demo rather than immersing them in each design.

**Required Changes:**

- **Botanical Flyer** should feel like an ornate printed poster: remove accordion interactions from service cards, use static numbered rows as in the source
- **Soft Spa Menu** should recreate the natural warmth and generous white space of Image #2: larger service cards with circular illustration wells (left side), minimal borders, no hover lifts
- **Consultation Studio** and **Reservation Concierge** can retain interactive patterns since they have no print analog, but should still feel cohesive with the salon brand
- Minimize or relocate the design switcher: consider making it a floating toggle or bottom-right widget instead of occupying prime sticky header real estate
- Remove "Source" buttons from within each design view—provide source access only through the switcher or a global control
- Ensure each design uses **distinct layout patterns**, not just different color variables

### 2. Botanical Decoration and Organic Elements

**Issue:** The current implementation uses CSS gradients (`leafDrift` animation, linear gradients) as a cheap substitute for the delicate watercolor botanical illustrations that give the source materials their refined character. The poster hero lazily overlays the source flyer image instead of recreating its structure.

**Required Changes:**

- Create or source actual **watercolor botanical SVG illustrations**: blue leaves for Botanical Flyer, sage sprigs and dried flower elements for Soft Spa Menu
- Position botanical decorations in corners, margins, and section dividers—sparingly, as accents
- Remove the background image overlay from `.posterHero` and rebuild the hero section using proper layered elements
- Use CSS masks or positioned SVGs for botanical elements, not gradient approximations
- Ensure botanical decorations respect `prefers-reduced-motion` and remain static or minimally animated

### 3. Typography Calibration and Hierarchy

**Issue:** Typography feels arbitrary (`h1` at `3.4rem`, `h2` at `1.9rem`) and doesn't match the confident, large-scale Japanese typography in the source materials. Prices and durations are functional but lack visual weight. Service numbers are too small (`1.2rem`).

**Required Changes:**

- **Increase heading sizes significantly**: Hero headlines should be at least `4.5rem` to `5.5rem` on desktop, with proper line-height for Japanese text (around `1.3` to `1.4`)
- **Price display** should be bold and prominent: use larger serif font for prices (`2.8rem` to `3.2rem`), treat duration and price as a visual pair
- **Service numbers** in Botanical Flyer should be larger and use the gold serif style from the source (at least `1.8rem`)
- Validate line breaks for long Japanese strings on mobile (e.g., `初回カウンセリング付き エクソソーム導入体験`)
- Use tighter letter-spacing (`-0.01em` to `-0.02em`) for large Japanese headings to match print aesthetic
- Ensure consistent vertical rhythm with a clear typographic scale (not arbitrary rem values)

### 4. Service Card Redesign

**Issue:** Service cards use a generic accordion pattern with expand/collapse, chevrons, and hover effects. This feels like a dashboard widget, not a refined salon menu. The source materials use simple, scannable rows (Pamphlet 1) or generous horizontal cards with illustration wells (Pamphlet 2).

**Required Changes for Botanical Flyer:**

- Remove expand/collapse interaction entirely
- Use static numbered rows: `number → icon → name + ingredient → duration → price → expand chevron (optional)`
- Display description and ideal concerns inline or in a persistent detail area below each row
- Remove hover `translateY` transforms
- Use gold serif numbers matching the source

**Required Changes for Soft Spa Menu:**

- Create horizontal service cards with **circular illustration wells** on the left (at least `120px` diameter)
- Commission or create custom watercolor illustrations for each service (droplet with glow, serum bottle, hand with sparkles)
- Increase card padding and white space significantly (match the generosity of Image #2)
- Remove borders between cards; use subtle dividers or just white space
- Price and duration should be right-aligned, large, and serif

**Required Changes for All Designs:**

- Replace `react-icons` (FiDroplet, FiStar) with custom illustrations or more refined icon treatments
- Recommended services should be indicated subtly (border accent, positioning) not with pill badges
- Selected state should be minimal: no heavy inset shadows, just a border or subtle background

### 5. Color Application and Material Quality

**Issue:** Colors are diluted with excessive `color-mix()` transparency. Shadows are too subtle. Doesn't capture the boldness of the navy or the warmth of the spa palette. Background gradients feel generic.

**Required Changes:**

- **Reduce color mixing**: Use source colors at full strength for primary elements. Reserve `color-mix()` for hover states and very subtle backgrounds
- **Bolder shadows**: Increase shadow opacity and spread for card elements. The source materials have clear depth
- **Botanical Flyer**: Use the deep navy (`#0b3d78` or `#143b65`) at full strength for headings and the footer area. Gold should be antique/warm (`#b38a3b`), used for accents and borders
- **Soft Spa Menu**: Background should feel like warm natural light on ivory paper. Use `#fbf8f1` to `#f3ece1` gradient with minimal additional effects
- **Remove generic background gradients**: The current `linear-gradient(90deg, rgba(220, 235, 248, 0.55)...` feels arbitrary. Use solid colors or subtle paper textures
- Consider adding very subtle noise or grain texture to backgrounds to enhance print material quality

### 6. Spatial Hierarchy and Reduced Boxiness

**Issue:** Everything is boxed and bordered. Sections, cards, panels, and buttons all have `border: 1px solid var(--line)` and `box-shadow: var(--shadow-soft)`. This creates visual clutter and reduces hierarchy. The source materials use generous white space and strategic borders.

**Required Changes:**

- **Reduce border usage**: Not every section needs a border. Use borders only for primary containers or to create clear separation
- **Eliminate nested card styling**: If a service card is inside a menu section, only one should have a border/shadow, not both
- **Increase whitespace**: Match the generous padding and margins of Image #2. Sections should breathe
- **Strategic shadow use**: Reserve shadows for floating elements (modals, sticky headers) and primary cards. Remove shadows from nested elements
- **Soft Spa Menu especially**: This design should have minimal borders—rely on white space, subtle dividers, and natural hierarchy

### 7. Interaction Restraint and Print Aesthetic

**Issue:** Too many interactive affordances (hover transforms, accordions, tabs, badges) make the experience feel like a web app, not a digital interpretation of refined print materials.

**Required Changes:**

- **Remove `translateY` hover effects** from service cards, concern pills, and other non-button elements
- **Simplify state changes**: Use subtle color or border changes instead of transforms and shadows
- **Botanical Flyer and Soft Spa Menu**: Treat these as interactive digital pamphlets, not dashboards. Information should be visible and scannable without requiring clicks
- **Limit accordions and drawers**: Expand/collapse should be reserved for truly secondary content (e.g., "Why this plan" in Consultation Studio)
- **Reduce tab complexity**: Contact method tabs are acceptable for Concierge, but shouldn't appear in every design
- **No generic pill badges**: The `recommendedBadge` pill feels like Material Design. Use positioning, color, or iconography to indicate recommendations

### 8. Botanical Flyer: Specific Fixes

**Critical Issues:**

- **Corner flourishes**: Current implementation uses simple CSS borders. Create actual ornamental corner graphics (SVG or CSS with multiple pseudo-elements)
- **Trust point icons**: Replace generic medallions with refined circular icons matching the source (face outline, map pin, clock)
- **LINE/Instagram footer**: The source shows a dark navy footer with gold text and QR codes. Recreate this as a distinct contact section with proper visual weight
- **Concern chips**: Current pills (`border-radius: 999px`) feel too modern. Use more restrained rectangular chips with subtle rounding (4px to 6px)
- **First-time offer ticket**: Good foundation, but remove the `goldShimmer` animation (feels gimmicky). Keep the corner accents and gold border
- **Hero section**: Remove the background image overlay. Build a proper layered hero with large Japanese headline, botanical SVG decorations in corners, and clean background

### 9. Soft Spa Menu: Specific Fixes

**Critical Issues:**

- **Curved white overlay**: Add the organic curved shape overlay visible in Image #2. Use clip-path or an SVG mask
- **Circular illustration wells**: Each service card needs a circular image/illustration container on the left (120-140px diameter)
- **Custom service illustrations**: Source or create watercolor-style illustrations: water droplet for high-exosome, serum bottle for premium-exosome, hand with sparkles for hand-care
- **Dotted leaders in Options**: The source shows delicate dotted lines between option names and prices (`パック ............. ¥2,000`). Implement with CSS or styled spans
- **Minimal borders**: Remove borders from individual service cards. Use white space and subtle dividers only
- **Natural light simulation**: Enhance the warm gradient background to feel like soft natural light on a product photo setup
- **Typography**: Use larger, more refined serif for the hero headline. Body text should be generous and readable

### 10. Meta-Demo UI Minimization

**Issue:** The demo currently prioritizes showcasing the design switching mechanism over letting each design stand on its own merits.

**Required Changes:**

- **Design switcher**: Make it more subtle. Options:
  - Relocate to bottom-right corner as a floating widget
  - Reduce size and visual prominence
  - Hide it entirely after initial load (show on hover/focus of a small toggle)
- **Remove "Demo contact" labels**: The drawer should just say "ご予約・ご相談" without "Demo contact" eyebrow
- **Source button consolidation**: Provide one global way to access source materials (e.g., through the switcher panel) rather than buttons scattered throughout each design
- **Keyboard shortcuts**: Keep the 1-4 shortcuts but don't advertise them visually in the UI

### 11. Design-Specific Component Patterns

**Issue:** All designs currently render the same components with different classes. True design differentiation requires different markup and interaction patterns.

**Required Changes:**

- **Botanical Flyer**: Static service list with inline details, ornamental dividers, poster-like hero, navy footer with QR/access inline
- **Soft Spa Menu**: Large service cards with illustration wells, minimal UI chrome, generous white space, dotted option leaders
- **Consultation Studio**: This can retain interactive controls (sliders, segmented buttons, stepper) but needs better visual refinement—less generic SaaS, more refined salon tool
- **Reservation Concierge**: Course picker cards should feel premium, not like a generic e-commerce product selector. Improve illustration/imagery for each course

### 12. Typography-Specific Action Items

**Immediate Fixes:**

```css
/* Example calibration for Botanical Flyer */
.botanicalFlyer h1 {
  font-size: clamp(3.2rem, 5vw, 5.2rem);
  line-height: 1.3;
  letter-spacing: -0.015em;
}

.botanicalFlyer h2 {
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  line-height: 1.35;
}

/* Price display */
.ticketPrice strong {
  font-size: clamp(2.8rem, 4vw, 3.6rem);
  font-weight: 600;
}

/* Service numbers */
.serviceNumber {
  font-size: 1.8rem;
  font-weight: 600;
}
```

### 13. Accessibility Without Interaction Overload

**Issue:** The current implementation assumes accessibility requires hover effects and interactive states everywhere. Print-inspired designs can be accessible without constant motion.

**Required Changes:**

- Maintain focus-visible states but remove hover transforms on non-interactive elements
- Service cards in Botanical Flyer and Soft Spa Menu can be `<article>` elements, not `<button>` wrappers, if they don't need to be clickable
- Use semantic HTML (`<section>`, `<article>`, headings) for screen reader navigation without forcing everything into an interaction pattern
- Reserve motion and transforms for true CTAs (reservation buttons, contact links)

### 14. Implementation Checklist

Before considering the demo complete, validate these items:

- [ ] Each design uses **distinct component markup**, not just CSS classes
- [ ] **Botanical decorations** are actual SVG elements, not CSS gradients
- [ ] **Typography scale** matches or exceeds the confidence of the source materials
- [ ] Service cards in Botanical Flyer are **static rows**, not accordions
- [ ] Service cards in Soft Spa Menu have **circular illustration wells** with custom graphics
- [ ] **Color application** is bold and matches source intensity (no over-mixing)
- [ ] **Borders and shadows** are strategic, not uniform across all elements
- [ ] **Hover effects** are limited to true interactive controls (buttons, links)
- [ ] **Design switcher** is minimized or relocated to reduce meta-demo visibility
- [ ] **Mobile layouts** translate the print aesthetic thoughtfully, not just stacking generically
- [ ] **Source materials** are accessible via a single, subtle entry point
- [ ] First-time offer ticket, concern selector, and trust points match source visual language
- [ ] Options section in Soft Spa Menu uses **dotted leaders** like the source
- [ ] LINE/Instagram footer in Botanical Flyer is recreated with proper navy + gold treatment

### 15. Design Philosophy Reset

**Core Principle:** This demo should showcase how to translate refined print design into digital experiences that feel **elevated, intentional, and true to the source material**—not how to build a generic multi-theme web app.

**Success Criteria:**

- A user viewing Botanical Flyer should feel like they're looking at an interactive version of Image #1, not a blue-themed web template
- A user viewing Soft Spa Menu should feel the warmth, natural light, and generous space of Image #2
- Consultation Studio and Reservation Concierge should feel like premium salon tools, not SaaS onboarding flows
- The design switching mechanism should be a subtle utility, not the primary focus of the experience
- Each design should stand on its own and be **memorable** for its unique aesthetic, not just "the blue one" or "the beige one"
