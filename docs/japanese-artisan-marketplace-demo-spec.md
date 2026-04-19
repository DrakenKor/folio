# Takumi Market — Demo Spec

## Summary

A standalone single-page marketplace demo for vetted Japanese craftspeople selling directly to a global audience. The experience should feel bright, spacious, editorial, and trustworthy — like a sunlit gallery, not a dim luxury storefront. Commerce-ready without requiring a backend. It demonstrates how the platform helps makers control their story, showcase products beautifully, localize pricing by region, and run auction-based releases for high-demand pieces.

Self-contained client-side demo. No production backend.

## Brand

**Takumi Market**

Tagline direction: *Vetted Japanese craft, shipped to the world.*

## Route

`/takumi-market-demo`

Single page. All views swap client-side. Every view is deep-linkable via query params.

URL pattern:

- `/takumi-market-demo` → Home
- `/takumi-market-demo?view=marketplace` → Browse
- `/takumi-market-demo?view=marketplace&category=kitchen-tools&sort=newest` → Filtered browse
- `/takumi-market-demo?view=maker&id=akari-kiln` → Maker shopfront
- `/takumi-market-demo?view=product&id=echizen-chef-knife` → Product detail
- `/takumi-market-demo?view=auction&id=limited-raku-bowl-drop` → Auction
- `/takumi-market-demo?view=about` → Trust & platform story

Region is always in the URL: `&region=USD` (default). Changing region updates the param in place without navigating away.

Browser back/forward must work correctly across all view transitions.

## Demo Goals

1. Japanese makers reach a global audience without becoming generic mass-market sellers.
2. The platform vets quality and provenance — buyers trust what they see.
3. Makers retain full control over storytelling, imagery, and shop identity.
4. Buyers browse and purchase globally with region-aware pricing, duties context, and shipping ETAs.
5. High-demand items allocate part of stock to timed auctions while the rest stays direct-purchase.

## Product Positioning

- selective, not sprawling
- premium but accessible
- global-first but rooted in Japanese place and craft
- fair to makers, not extractive
- bright and open, not corporate or heavy

## Core User Types

**Buyers** — global consumers, design-conscious collectors, gift buyers seeking provenance, repeat customers following favorite makers and drops.

**Makers** — ceramics studios, knife makers, textile artisans, woodworkers, paper/lacquer/metal/tea/incense/homeware brands.

**Platform** — curates and vets listings, assists with logistics and translation, manages regional merchandising and auction events.

## Experience Principles

- **Story first.** Every product connects to a person, place, and process.
- **Trust visible everywhere.** Vetting, provenance, materials, lead times, shipping — all explicit.
- **Commerce without clutter.** Bright, calm, spacious — no marketplace chrome overload.
- **Global readiness.** Region, currency, shipping, duties — easy to understand.
- **Maker dignity.** The platform amplifies artisans. It is not the hero.

---

## Views

### 1. Home

Purpose: establish brand, trust, and mood immediately. Should feel editorial and bright — a contemporary design magazine merged with a sunlit gallery opening.

Content blocks (top to bottom):

- **Cinematic hero.** Full-bleed luminous image with gentle parallax. Headline, subline, and a single CTA ("Explore the Market") placed on a frosted-glass panel (backdrop-filter: blur(20px), white at 80% opacity) — never on a dark overlay. Subtle slow ken-burns or parallax drift. No autoplay video on mobile.
- **Region selector strip.** Inline pill selector for the 5 regions. Selecting a region animates all visible prices to the new currency with a counting transition.
- **Featured makers carousel.** Horizontal scroll of 3-4 maker cards with studio image, name, location, craft category, and a one-line quote. Click navigates to maker view.
- **Category grid.** 6 categories as large image tiles with overlaid labels. Click navigates to marketplace filtered by that category.
- **Trust strip.** Horizontal row of trust markers with icons: "Vetted makers only", "Verified provenance", "Materials disclosed", "Global shipping", "Fair pricing". Each animates in on scroll.
- **Live auction teaser.** Card showing the current or next auction — item image, countdown timer (ticking live), current bid, and a CTA to view the auction.
- **Fulfillment map.** Stylized SVG map showing shipping routes from Japan to the 5 regions with estimated delivery windows. Selecting a region highlights that route.
- **Footer.**

### 2. Marketplace

Purpose: browse all products and makers with filtering and sorting.

Layout:

- **Filter bar** (sticky on scroll): category pills, sort dropdown (Newest, Price Low→High, Price High→Low, Maker A→Z), and a "Collections" dropdown.
- **Product grid.** 3 columns on desktop, 2 on tablet, 1 on mobile. Infinite scroll is not needed — show all products with a staggered fade-in on mount.

Product card anatomy:

- Product image (4:5 aspect ratio) with hover crossfade to a second image or process shot
- Product name
- Maker name (clickable → maker view)
- Origin prefecture
- Localized price (animates on region change)
- Stock badge: "In Stock", "Low Stock" (≤3), "Made to Order", "Sold Out" (greyed, not purchasable), or "Auction Live" (links to auction)
- Vetted checkmark badge
- Craft category tag
- On hover: a 2-line story snippet slides up from the bottom of the card

**Maker spotlight cards** are interspersed in the grid every 8 items. They span the full grid width, show a landscape studio image, maker name, philosophy excerpt, and a "Visit Shopfront" CTA.

**Curated collections:** 3 named collections ("The Summer Table", "First Kitchen", "Tea Ceremony Essentials"). Each is a preset filter on the marketplace grid — selecting a collection filters the products with a smooth layout animation and shows a collection header with a short editorial description.

**Search:** A search icon in the header opens a full-width overlay with a text input. Filters products and makers by name, category, origin, and material in real-time as the user types. Shows results grouped into "Products" and "Makers" sections. Empty state: "No results — try browsing by category." Escape or clicking outside closes the overlay.

### 3. Maker View

Purpose: show how makers control their shopfront. This should feel like a customizable brand page, not a generic seller profile.

Content blocks:

- **Maker hero.** Full-width image with the maker's name, location, craft discipline, and a short tagline overlaid. Each maker has a distinct accent color that tints borders, tags, and highlights throughout their shopfront.
- **Profile story.** 2-3 paragraph biography written in the maker's voice. Includes a pull quote styled as a large italic callout.
- **Process gallery.** Horizontal scrolling strip of 4-6 images showing studio, materials, tools, and process steps. Each image has a short caption. Swipeable on mobile.
- **Milestones.** A compact vertical timeline: founding year, key moments (e.g., "First international exhibition", "Third-generation takeover"), and year joined Takumi Market.
- **Materials & techniques.** Grid of labeled icons or tags: clay type, kiln method, wood species, steel composition — whatever is relevant to the craft.
- **Product collection.** Grid of this maker's products (same card component as marketplace).
- **Studio location.** Prefecture name, a one-line description of the region's craft heritage, and a small illustrative map dot.
- **Maker notes.** A short, informal closing note from the maker, presented like a handwritten card.

Maker accent theming: each maker defines an accent color in a soft, mid-tone range (e.g., soft indigo for ceramics, warm copper for metalware). These are never dark or saturated — they should feel like watercolor washes. The accent is used for pull-quote left borders, milestone timeline dots, tag backgrounds (at 10% opacity), and hover states on their shopfront. It reinforces that makers control their visual identity while maintaining the overall bright, airy feel.

### 4. Product View

Purpose: combine product storytelling with purchase intent.

Layout: two-column on desktop (media left, details right). Single column on mobile.

**Media gallery (left column):**

- Primary image (large, 4:5)
- Thumbnail strip below with 3-5 images. Clicking a thumbnail swaps the primary image with a crossfade.
- One thumbnail can be a short looping video clip (process/detail shot). Plays inline, muted, with a subtle play icon overlay.

**Details (right column):**

- Product name, maker name (clickable → maker view), origin, craft category
- Localized price (large, prominent)
- Stock state badge
- Quantity selector (1-5, or "Made to Order" note if applicable)
- **"Add to Cart" button** — primary CTA. On click: button briefly shows a checkmark animation, cart count in header increments, and a toast slides in from the top-right: "[Product name] added to cart" with an "Open Cart" link. If the product is sold out, the button is disabled and reads "Sold Out".
- If the product has auction allocation: a secondary section below the CTA shows "X of Y units available at fixed price. Z units in live auction." with a link to the auction view.
- Shipping estimate: "Ships to [region] in X-Y weeks" (varies by region from mock data)
- Duties note: "Import duties may apply for [region]"

**Story tabs** below the fold (both columns):

- **Overview** — materials, dimensions, weight, care instructions in a clean spec table.
- **Process** — 3-4 paragraphs on how the item is made, with inline images.
- **Shipping** — per-region shipping table showing ETA and shipping cost for each of the 5 regions.
- **Maker Notes** — a short personal note from the maker about this specific piece.

**Provenance card:** A clean card on cloud gray (#F2F2F2) background with a minimal circular verification mark (1px outline, checkmark icon) showing: "Vetted by Takumi Market", verification date, origin verified, materials disclosed, process documented. No faux-vintage stamp — the trust aesthetic is modern and clinical.

**Related products:** A row of 3-4 product cards from the same maker or category.

### 5. Auction View

Purpose: demonstrate how high-demand releases work fairly. Should feel exciting but trustworthy, not speculative.

Layout:

- **Auction hero.** Large product image with the auction title and item name.
- **Countdown timer.** Large, ticking in real-time (hours:minutes:seconds). When the demo timer reaches zero, the UI transitions to a "This auction has ended" state showing the final price and "Winner: Bidder #47" as mock data.
- **Current bid.** Large price display in the selected currency. Updates with a counting animation when a simulated bid arrives.
- **Bid input.** The user can place a mock bid. Interface: the current minimum bid is shown, with preset increment buttons (+$10, +$25, +$50 or equivalent in selected currency). Clicking a bid button shows a confirmation modal: "Place bid of [amount]?" with Confirm/Cancel. On confirm: a success toast, the bid ladder updates, and the user's bid appears highlighted in the ladder.
- **Bid ladder.** A vertical list of the last 8-10 bids showing: bid amount, anonymized bidder ID ("Bidder #12"), and relative timestamp ("2 min ago"). New bids animate in from the top. The user's own bids are highlighted with an accent color.
- **Simulated bid activity.** Every 15-30 seconds (randomized), a fake competing bid arrives with a subtle pulse animation. This keeps the auction feeling alive. Simulated bids stop when the timer ends.
- **Inventory split.** A clear visual showing "3 of 8 units in this auction · 5 available at fixed price" with a link to buy at fixed price.
- **Fairness rules.** A collapsible section explaining: only a portion of inventory enters auction; auction is reserved for exceptionally limited pieces; remaining stock stays fixed-price; makers benefit from upside on rare demand spikes; no shill bidding.
- **Related direct-purchase items.** A row of 3-4 product cards that can be bought immediately.

### 6. About / Trust View

Purpose: explain the platform's existence, values, and mechanisms. Should feel like a confident brand manifesto, not a generic FAQ page.

Content blocks:

- **Hero statement.** Large editorial typography: "We believe great craft deserves a global stage — and the makers behind it deserve a fair deal."
- **How vetting works.** A 4-step horizontal process visualization (animated on scroll): Application → Studio Review → Sample Evaluation → Listing. Each step has an icon, short description, and a stat ("127 makers applied, 23 selected" — mocked but specific).
- **What we do for makers.** Grid of 4 support cards: Translation & Localization, Photography & Storytelling, Global Logistics, Regional Pricing. Each with an icon and 2-sentence description.
- **Pricing principles.** Transparent breakdown: "Makers set their own prices. We add a flat 15% platform fee. No hidden commissions. No pay-to-rank."
- **Provenance & trust.** Anti-counterfeit language, verification process, materials disclosure policy. Presented with the minimal circular verification motif on a dot-grid background.
- **Platform stats.** A row of large numbers: "23 Vetted Makers · 180+ Products · 5 Shipping Regions · 12 Craft Disciplines" (mocked).
- **FAQ.** 6-8 collapsible questions covering: How are makers selected? How does auction work? Are prices negotiable? What about returns? How are duties handled? Can I visit a maker's studio?

---

## Feature Requirements

### Regional Pricing

5 regions, always visible and switchable:

| Region | Currency | Flag | Shipping ETA from Japan |
|--------|----------|------|-------------------------|
| Japan | JPY | 🇯🇵 | 1-3 days |
| United States | USD | 🇺🇸 | 7-14 days |
| Europe | EUR | 🇪🇺 | 10-18 days |
| United Kingdom | GBP | 🇬🇧 | 10-16 days |
| Singapore | SGD | 🇸🇬 | 5-10 days |

Use text flag labels (e.g., "JP", "US") rather than emoji flags for consistency.

Behavior:

- Default region: USD. Persisted in URL as `&region=USD`.
- Prices use a mocked conversion table per product (not live FX). Base prices are in JPY.
- On region change: all visible prices animate with a fast counting transition (200ms). The region selector itself shows a subtle highlight animation.
- Each product's shipping tab shows per-region ETA and cost.
- A small note under prices: "Taxes & duties may apply at import."

### Search

The header search icon opens a full-screen overlay (mobile) or a dropdown panel anchored to the header (desktop).

- Input is auto-focused on open.
- Filters as the user types (debounced 150ms).
- Results grouped: **Products** (show card with image, name, price) and **Makers** (show avatar, name, craft). Max 5 per group.
- Clicking a result navigates to that product/maker view and closes search.
- Empty query shows nothing. No results shows "Nothing found — try browsing by category."
- Close with Escape, clicking outside, or clicking the X button.

### Cart & Checkout

**Cart state** is managed in a Zustand store. It does not persist across page reloads (no localStorage needed for a demo).

**Add to cart:**

- Button on product view. Disabled if sold out.
- On click: checkmark animation on the button (300ms), cart badge count increments in the header with a scale bounce, toast notification slides in from top-right ("Kuro-oribe Tea Bowl added to cart" with "View Cart" link). Toast auto-dismisses after 4 seconds.
- Adding the same product again increments quantity (max 5 per item).

**Cart drawer:**

- Opens from the right side of the screen (slide-in, 400px wide on desktop, full-width on mobile).
- Triggered by clicking the cart icon in the header, or the "View Cart" link in a toast.
- Drawer content:
  - Header: "Your Cart" with item count and a close (X) button.
  - List of cart items: product image (small thumbnail), name, maker, quantity selector (1-5 with +/- buttons), localized line price, remove button (X icon).
  - Removing an item animates it out (fade + collapse height).
  - Subtotal in selected currency.
  - Shipping estimate for selected region.
  - Duties note: "Import duties may apply."
  - **"Proceed to Checkout" button.**
- Empty cart: "Your cart is empty" with a "Browse the Market" CTA.
- Drawer has a light semi-transparent backdrop (white at 60% opacity with backdrop-filter: blur(8px)). Clicking the backdrop closes the drawer. Escape closes it. Focus is trapped inside the drawer while open.

**Checkout modal:**

- Triggered by "Proceed to Checkout" in the cart drawer.
- The cart drawer closes, and a centered modal opens with a 3-step stepper:
  1. **Shipping** — pre-filled with the selected region. Shows a placeholder address form (name, address lines, city, postal code, country dropdown defaulting to selected region). Fields are interactive but not validated.
  2. **Payment** — mock credit card form (card number, expiry, CVC). Placeholder only, no validation. Shows a reassurance strip: "Secure checkout · SSL encrypted."
  3. **Review** — order summary: items, quantities, prices, shipping cost, estimated duties, total.
- Each step has Back and Continue buttons. The final step has "Place Order".
- On "Place Order": a 1.5-second loading spinner, then a confirmation screen with a checkmark animation, order number (mocked), and "Thank you for your order. Your items will ship from Japan within 3-5 business days." The cart is cleared.
- Close the modal at any point with X or Escape (returns to browsing, cart state preserved).

### Vetting / Trust Model

Every maker and product surfaces trust markers:

- Vetted Maker (checkmark badge)
- Verified Origin (prefecture + region)
- Materials Disclosed (linked to spec table)
- Process Documented (linked to process tab/gallery)
- Small-batch / Made-to-Order status

Trust markers appear as small icon+label pairs. They show on product cards (condensed: just the checkmark), product detail views (full list), and maker views (full list with verification date).

### Maker Control

Each maker's shopfront demonstrates these maker-controlled elements, visually marked with a subtle "Maker Curated" label where appropriate:

- Hero imagery and layout
- Accent color (tints borders, tags, hover states)
- Studio story and philosophy
- Pull quote
- Process gallery with captions
- Product descriptions and featured order
- Maker notes (personal voice)

### Notifications

A toast notification system for transient feedback:

- Appears top-right on desktop, top-center on mobile.
- Style: white background, 12px border-radius, soft shadow (0 4px 20px rgba(0,0,0,0.08)), with a 3px left border in the type color.
- Types: success (fresh green #4CAF7D), info (sky blue #4A90D9), neutral (whisper gray #E5E5E5).
- Used for: add to cart, bid placed, region changed, auction ended.
- Auto-dismiss after 4 seconds with a fade-out. Can be manually dismissed with X.
- Max 3 toasts stacked with 8px gaps. Oldest dismissed first.

---

## Visual Direction

**Mood: Bright gallery on a clear morning.** Think whitewashed concrete walls, floor-to-ceiling windows, objects breathing in open space. The design should feel like walking into a curated exhibition where every piece has room to exist — not a dim, moody storefront. Light is the primary material.

Avoid generic luxury ecommerce. Avoid cliche Japan imagery (cherry blossoms, torii gates, etc.). Avoid dark/heavy/parchment aesthetics. The vibe is closer to a Scandinavian-Japanese hybrid: Aesop meets Muji meets a bright Kyoto machiya with the shutters thrown open.

**Palette:**

- Background: pure white (#FFFFFF) and snow (#FAFAFA) — no warm tints, no cream, no parchment
- Primary text: soft black (#2D2D2D) — never pure #000
- Secondary text: cool mid-gray (#8C8C8C)
- Tertiary text / captions: light gray (#B5B5B5)
- Accent: sky blue (#4A90D9) — calm, trustworthy, airy
- Secondary accent: soft coral (#E8836B) — warm counterpoint, used sparingly for CTAs and highlights
- Surface: cloud gray (#F2F2F2) — cards, panels, filter bars
- Borders: whisper gray (#E5E5E5) — barely there, just enough structure
- Error/alert: clear red (#D94B4B)
- Success: fresh green (#4CAF7D)
- Auction live: soft amber (#E9A84C)

The palette is intentionally cool-neutral. Color comes from the product photography itself — the UI is a clean frame that lets craft objects supply the warmth and texture.

**Typography:**

- Headlines: "Cormorant Garamond" (Google Fonts) — a high-contrast, refined serif with an editorial feel. Used at large sizes (clamp-based fluid type from 2rem to 4.5rem). Light or regular weight only. Generous letter-spacing (+0.02em) and slightly tight line-height (1.15) for a composed, poster-like quality.
- Body: "Outfit" (Google Fonts) — a geometric sans-serif with soft terminals and excellent legibility. Weight 300-400. Line height 1.7. Size 15-16px.
- UI / labels / badges: Outfit at 12-13px, weight 500, uppercase with wide tracking (+0.08em). Used for category tags, stock badges, navigation labels.
- Prices: Outfit weight 400, tabular-nums. No monospace — prices should feel integrated, not technical.
- Pull quotes: Cormorant Garamond italic, 1.8-2.5rem, with a thin left border in the maker's accent color.

**Spatial Philosophy — "Ma" (interval/negative space):**

- Whitespace is the dominant design element. Sections are separated by 80-120px of empty space, not dividers.
- No ruled lines between sections. Breathing room replaces borders.
- Cards have no visible borders. They float on the white page, distinguished only by their content and a barely-there shadow (0 2px 12px rgba(0,0,0,0.04)) on hover.
- Max content width: 1200px, centered with generous side padding (clamp 24px to 80px).
- Product grid gaps: 32px on desktop, 20px on mobile. The gaps matter as much as the cards.
- Asymmetric layouts where possible — maker pages, product detail, and the home hero should avoid rigid symmetry. Off-center headings, images that bleed past their column, text blocks that don't fill their containers.

**Motifs:**

- **Floating cards.** Cards sit on white with no borders, only content and negative space to define them. On hover, a soft shadow lifts them up (translateY(-2px) + shadow expansion). No background color change.
- **Thin accent lines.** Sparingly used — a single 1px line in #E5E5E5 under the header, under tab bars. Never between content sections.
- **Rounded softness.** Generous border-radius everywhere: 12px on cards, 8px on buttons, 20px on pills/badges. Nothing sharp-cornered.
- **Provenance seal.** A minimal circular outline (1px, #E5E5E5) with a small checkmark icon and "Verified" label. Clean and modern, not a faux-vintage stamp.
- **Dot patterns.** Subtle dot-grid pattern (1px dots, 24px spacing, #F0F0F0 on white) used as a section background for trust strips and the about page — evokes graph paper / precision / craft without heaviness.

**Imagery:**

- Use high-quality royalty-free images from Unsplash sourced for: Japanese ceramics, knives, textiles, woodwork, paper craft, tea ceremony, artisan workshops.
- Product images: clean, **bright**, well-lit, shot on white or near-white backgrounds. 4:5 aspect ratio. The images should feel overexposed-adjacent — flooded with natural light.
- Maker/studio images: environmental, showing the workspace with natural window light. 16:9 aspect ratio. Prefer images where daylight is visible.
- Hero images: wide, luminous, high-key. Not dark or moody. Think: morning light on a workbench, sunlit ceramics on a white shelf, a knife blade catching window light.
- All images served via Unsplash URLs with size parameters for performance. Alt text on every image describing the craft/product.
- Image treatment: no overlays, no dark gradients. If text appears over an image, use a frosted-glass panel (backdrop-filter: blur(20px) with white at 80% opacity) rather than a dark scrim.

---

## Motion and Interaction

Motion should feel like breathing — gentle, unhurried, natural. Everything eases in softly. Nothing snaps, nothing bounces aggressively. The motion language is "things appearing" rather than "things arriving."

**Easing:** use `cubic-bezier(0.25, 0.1, 0.25, 1.0)` (a soft ease-out) as the default for all transitions. Never use linear or harsh ease-in.

**View transitions:** fade in (250ms) with a subtle upward drift (10px translateY). Scroll position resets to top on view change. The outgoing view simply fades — no slide-out.

**On-scroll animations:** elements fade-in and translate-up (16px) as they enter the viewport. Staggered for lists (60ms between items, starting from opacity 0). Use IntersectionObserver with a threshold of 0.1. Elements should feel like they're floating up into place.

**Product card hover:** second image crossfades in (400ms — slow, like a developing photograph). Subtle lift (translateY(-2px)) and shadow expansion. No scale transform — the card stays composed.

**Price transitions:** on region change, prices animate with a fast counting effect (200ms). Numbers roll to the new value.

**Auction countdown:** ticks every second. Numbers use a smooth counting animation (no flips — too heavy for this aesthetic). When reaching <1 minute, the timer text color transitions to soft amber (#E9A84C).

**Cart interactions:** drawer slides in from right (350ms ease-out). Items animate out on removal (250ms fade + height collapse). Cart badge shows a brief scale pulse (1.0 -> 1.15 -> 1.0, 300ms) on increment.

**Parallax:** hero images shift at 0.3x scroll speed (subtler than typical). Disable on mobile and reduced-motion.

**Hover states:** buttons and interactive elements transition background-color over 200ms. Links underline with a bottom-border that animates from width 0 to 100% on hover. No color-change jolts.

**Reduced motion:** all animations respect `prefers-reduced-motion`. Fallback to instant state changes with no transforms or transitions.

---

## Information Architecture

### Global Header

Sticky. Tall and spacious (72px desktop, 56px mobile). White background with a single 1px bottom border (#E5E5E5). No shadow. The header should feel like it's barely there — transparent structure.

Contains:

- **Wordmark:** "Takumi Market" in Cormorant Garamond, regular weight, left-aligned. Size: 1.25rem. No logo mark — the type is the brand.
- **Nav links:** Home, Marketplace, About. Styled in Outfit, weight 400, 13px, uppercase, tracked (+0.06em), cool gray (#8C8C8C). Active view uses soft black (#2D2D2D) with a 2px bottom border in sky blue. Hover: text transitions to soft black.
- **Search icon:** minimal line-art magnifying glass, 20px. Opens search overlay.
- **Region selector:** pill-shaped button showing current region code (e.g., "USD") in the UI label style. On click, opens a minimal dropdown with the 5 options. Selected option has a sky blue dot indicator.
- **Cart icon:** minimal line-art shopping bag, 20px. Badge is a small filled circle (sky blue, 16px) with white text count. Hidden when cart is empty. Click opens cart drawer.

All header icons and text have generous spacing between them (24px gaps minimum). The header should never feel crowded.

Mobile header: wordmark left, cart icon and hamburger right. Hamburger opens a full-screen white nav overlay with centered links, region selector, and search. Cart icon remains visible next to the hamburger.

### Footer

- Platform mission one-liner
- Shipping regions list
- Links: About, Trust, FAQ (all navigate to the About view)
- "Subscribe for new maker drops" — email input with a submit button. On submit: input clears and shows "Subscribed" inline. No real backend call.
- Small print: "This is a demo experience. No real transactions."

---

## Mock Data Model

### TypeScript Interfaces

```typescript
type Region = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'SGD'

type Category = 'tableware' | 'kitchen-tools' | 'textiles' | 'tea-ritual' | 'paper-goods' | 'home-objects'

type StockStatus = 'in-stock' | 'low-stock' | 'made-to-order' | 'sold-out' | 'auction-only'

interface RegionalPricing {
  JPY: number
  USD: number
  EUR: number
  GBP: number
  SGD: number
}

interface ShippingInfo {
  region: Region
  estimatedDays: [number, number]  // [min, max]
  cost: number                      // in that region's currency
}

interface Maker {
  id: string                        // slug, e.g., "akari-kiln"
  name: string
  location: string                  // e.g., "Uji, Kyoto Prefecture"
  craft: string                     // e.g., "Ceramics"
  tagline: string
  accentColor: string               // hex, e.g., "#1E3A5F"
  story: string                     // 2-3 paragraphs
  pullQuote: string
  founded: number                   // year
  milestones: { year: number; event: string }[]
  materials: string[]               // e.g., ["Iron-rich stoneware clay", "Ash glaze"]
  techniques: string[]              // e.g., ["Wheel throwing", "Wood-fired kiln"]
  heroImage: string                 // URL
  processImages: { url: string; caption: string }[]
  makerNotes: string                // closing personal note
  verified: boolean
  verifiedDate: string              // e.g., "2024-09"
}

interface Product {
  id: string                        // slug
  name: string
  makerId: string                   // references Maker.id
  category: Category
  origin: string                    // prefecture
  description: string               // 2-3 sentences
  story: string                     // longer process/story text for the Process tab
  materials: string[]
  technique: string
  dimensions: string                // e.g., "Ø12cm × H8cm"
  weight: string                    // e.g., "320g"
  care: string                      // e.g., "Hand wash. Not microwave safe."
  pricing: RegionalPricing
  shipping: ShippingInfo[]          // one per region
  stockStatus: StockStatus
  stockCount?: number               // if in-stock or low-stock
  images: string[]                  // URLs, first is primary
  videoUrl?: string                 // optional process clip
  makerNotes?: string               // optional personal note about this piece
  auctionId?: string                // if partially in auction
  collections: string[]             // collection slugs this product belongs to
}

interface Auction {
  id: string                        // slug
  productId: string                 // references Product.id
  title: string                     // e.g., "Limited Raku Bowl Drop"
  auctionUnits: number              // units in auction
  totalUnits: number                // total production run
  startingBid: RegionalPricing
  currentBid: RegionalPricing
  bidHistory: {
    bidderId: string                // e.g., "Bidder #12"
    amount: RegionalPricing
    timestamp: string               // relative, e.g., "2 min ago"
  }[]
  endsAt: string                    // ISO datetime, set to ~30 min from now for demo
  status: 'live' | 'upcoming' | 'ended'
  fairnessRules: string[]
}

interface Collection {
  id: string                        // slug
  name: string                      // e.g., "The Summer Table"
  description: string               // editorial blurb
  productIds: string[]
}

interface CartItem {
  productId: string
  quantity: number                   // 1-5
}
```

### Data Volume

- 6 makers
- 20 products (3-4 per maker)
- 2 auctions (1 live, 1 upcoming)
- 5 regions
- 6 categories
- 3 collections

### Maker Roster

| Maker | Location | Craft | Accent Color |
|-------|----------|-------|--------------|
| Akari Kiln | Uji, Kyoto | Ceramics | Soft indigo (#6B8CBA) |
| Takeshi Hamono | Sakai, Osaka | Kitchen Knives | Warm copper (#C4836A) |
| Kurashiki Textile Mill | Kurashiki, Okayama | Textiles | Dusty rose (#C4929B) |
| Echizen Washi Studio | Echizen, Fukui | Paper Craft | Sage (#8BAF92) |
| Hida Woodcraft | Takayama, Gifu | Woodwork | Warm oak (#B89B7A) |
| Tsubame Metalworks | Tsubame, Niigata | Metalware | Cool slate (#8E9DAB) |

---

## Mobile Behavior

- **Header:** wordmark left, cart icon and hamburger right. Hamburger opens full-screen nav overlay (links, region selector, search).
- **Product grid:** single column. Cards stack vertically with no hover effects (hover states are touch-unfriendly).
- **Product view:** single column. Media gallery becomes a horizontal swipeable carousel with dot indicators.
- **Cart:** full-screen sheet sliding up from bottom instead of a side drawer.
- **Checkout modal:** full-screen on mobile.
- **Search:** full-screen overlay with large input.
- **Carousels/galleries:** swipeable with momentum scrolling. Show partial next item as a scroll hint.
- **Region selector:** bottom sheet instead of dropdown popover.
- **Auction bid input:** full-width increment buttons, larger tap targets (min 44px).
- **Hero parallax:** disabled on mobile. Static image instead.
- **Breakpoints:** mobile (<768px), tablet (768-1024px), desktop (>1024px).

---

## State Management

Use a single Zustand store for all demo state:

```typescript
interface TakumiStore {
  // Region
  region: Region
  setRegion: (region: Region) => void

  // Cart
  cart: CartItem[]
  addToCart: (productId: string) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  cartOpen: boolean
  setCartOpen: (open: boolean) => void

  // Search
  searchOpen: boolean
  searchQuery: string
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void

  // Auction (simulated state)
  auctionBids: Record<string, { bidderId: string; amount: RegionalPricing; timestamp: string }[]>
  userBids: Record<string, number[]>  // auction ID → list of bid amounts in JPY
  placeBid: (auctionId: string, amountJPY: number) => void

  // Toast notifications
  toasts: { id: string; message: string; type: 'success' | 'info' | 'neutral'; link?: { label: string; view: string } }[]
  addToast: (toast: Omit<TakumiStore['toasts'][0], 'id'>) => void
  dismissToast: (id: string) => void
}
```

View routing is not in the store — it lives in the URL via query params, read with `useSearchParams()` and written with `router.replace()`.

---

## Loading & Empty States

- **View transitions:** a brief crossfade (200ms). No loading spinners for view changes since data is local.
- **Image loading:** show a cloud gray (#F2F2F2) placeholder rectangle at the correct aspect ratio. Fade in the image on load (250ms).
- **Marketplace with no filter results:** "No products match your filters. Try a different category or clear your filters." with a "Clear Filters" button.
- **Empty cart:** "Your cart is empty. Browse the market to find something you love." with a "Browse the Market" CTA.
- **Checkout loading:** a centered spinner with "Preparing your order..." text for 1.5 seconds.
- **Auction ended:** timer shows "00:00:00", bid input is disabled, a banner reads "This auction has ended" with the winning bid and bidder shown.

---

## Accessibility

- Keyboard navigation through all interactive elements with visible focus rings (2px sky blue (#4A90D9) outline, 2px offset).
- Tab order follows visual layout. Focus trapped inside modals, cart drawer, and search overlay.
- Escape closes any open overlay (cart, search, checkout, modals).
- All images have descriptive alt text (e.g., "Kuro-oribe tea bowl with dark green glaze and irregular rim, made by Akari Kiln").
- Auction countdown is wrapped in an `aria-live="polite"` region, updating every 30 seconds (not every tick) to avoid screen reader noise.
- Region selector, tabs, and FAQ accordions use proper ARIA roles (`role="tablist"`, `role="tab"`, `aria-expanded`, etc.).
- Color contrast meets WCAG AA on all text.
- Reduced motion: all transitions and animations disabled. Immediate state changes.

---

## Performance

- Fast first render: all mock data is bundled, no network fetches.
- Images: use Unsplash `w=` and `q=` params to serve appropriately sized images. Desktop hero: 1600px wide. Product cards: 400px wide. Thumbnails: 100px wide.
- Lazy load images below the fold with `loading="lazy"`.
- View components can be code-split with `React.lazy` if the bundle gets large, but start without this.
- All animations use `transform` and `opacity` only — no layout-triggering properties.
- Auction timer uses `requestAnimationFrame` or a 1-second `setInterval`, not re-rendering the entire view.
- Debounce search input (150ms).

---

## Technical Scope

### In Scope

- One new route: `src/app/takumi-market-demo/page.tsx`
- Client-side view router via query params
- Self-contained mock data (co-located in the route folder)
- Zustand store (co-located)
- All 6 views with full interactivity
- Cart, checkout, auction bidding, search — all functional as described
- Responsive across mobile/tablet/desktop
- Accessible
- Performant

### Out of Scope

- Real payments or payment provider integration
- Backend API or database
- Live exchange rates
- Authentication or user accounts
- Seller dashboard or admin tools
- Real auction settlement
- Translation pipeline or i18n
- Server-side rendering (this is a client-side demo)

### Implementation Structure

```
src/app/takumi-market-demo/
  page.tsx                    # Entry point, view router
  components/
    Header.tsx
    Footer.tsx
    SearchOverlay.tsx
    CartDrawer.tsx
    CheckoutModal.tsx
    Toast.tsx
    RegionSelector.tsx
    ProductCard.tsx
    MakerCard.tsx
    views/
      HomeView.tsx
      MarketplaceView.tsx
      MakerView.tsx
      ProductView.tsx
      AuctionView.tsx
      AboutView.tsx
  data/
    makers.ts
    products.ts
    auctions.ts
    collections.ts
    regions.ts
  store.ts
  types.ts
```

Everything is self-contained within the route folder. No dependencies on existing portfolio components.

---

## Build Checklist

- [ ] Mock data model with all types, makers, products, auctions, collections, and regions
- [ ] Zustand store with cart, region, search, auction, and toast state
- [ ] Global shell: header (nav, search, region, cart), footer, view router
- [ ] Home view with hero, region selector, featured makers, categories, trust strip, auction teaser, fulfillment map
- [ ] Marketplace view with filtering, sorting, collections, product grid, maker spotlights, search
- [ ] Maker view with hero, story, process gallery, milestones, materials, product grid, accent theming
- [ ] Product view with media gallery, details, add to cart, stock states, shipping info, story tabs, provenance card, related products
- [ ] Auction view with countdown, bid input, bid ladder, simulated activity, inventory split, fairness rules
- [ ] About view with vetting process, support cards, pricing principles, platform stats, FAQ
- [ ] Cart drawer with items, quantity controls, removal, subtotal, checkout CTA
- [ ] Checkout modal with 3-step flow and confirmation
- [ ] Toast notification system
- [ ] Search overlay with live filtering
- [ ] Region-aware pricing with animated transitions everywhere
- [ ] Responsive layout (mobile, tablet, desktop)
- [ ] Scroll animations and view transitions
- [ ] Reduced motion support
- [ ] Keyboard navigation and ARIA roles
- [ ] Image alt text on all media

## Recommended Build Order

1. Types, mock data, and Zustand store.
2. Global shell: header, footer, view router, region selector, toast system.
3. Home view.
4. Marketplace view with filtering, sorting, collections, and search.
5. Product view with media gallery, add to cart, and story tabs.
6. Maker view with accent theming and process gallery.
7. Cart drawer and checkout modal.
8. Auction view with countdown, bidding, and simulated activity.
9. About view.
10. Responsive tuning, scroll animations, motion polish, and accessibility pass.
