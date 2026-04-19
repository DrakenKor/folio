import { createPricing, createShipping } from './regions'
import { Product } from '../types'

const img = (seed: string, width: number, height: number) =>
  `https://picsum.photos/seed/${seed}/${width}/${height}`

const compactShipping = createShipping(2400, {
  JPY: [1, 3],
  USD: [7, 12],
  EUR: [10, 16],
  GBP: [10, 15],
  SGD: [5, 9]
})

const mediumShipping = createShipping(3600, {
  JPY: [1, 3],
  USD: [8, 14],
  EUR: [10, 18],
  GBP: [10, 16],
  SGD: [5, 10]
})

const largeShipping = createShipping(5400, {
  JPY: [2, 4],
  USD: [9, 15],
  EUR: [12, 18],
  GBP: [11, 17],
  SGD: [6, 10]
})

export const products: Product[] = [
  {
    id: 'kuro-oribe-tea-bowl',
    name: 'Kuro-Oribe Tea Bowl',
    makerId: 'akari-kiln',
    category: 'tea-ritual',
    origin: 'Kyoto Prefecture',
    description:
      'A small-batch tea bowl with a dark mineral glaze, soft irregular rim, and steady foot. Built for matcha, but just as convincing with fruit, sweets, or soup.',
    story:
      'Thrown from iron-rich stoneware and trimmed after a short rest, this bowl is glazed with a rice-straw ash blend that pools dark green where the wall thickens. The rim is left slightly unsettled so the hand feels motion rather than perfection.\n\nEach firing brings gentle variation in the glaze field and the small blushes where ash drifts across the body. Akari Kiln keeps the interior broad enough for whisking without sacrificing the intimate scale that makes the bowl feel personal.\n\nIt is the kind of piece that looks strongest in daylight, especially on pale wood or linen.',
    materials: ['Iron-rich stoneware clay', 'Ash glaze'],
    technique: 'Wheel thrown and wood fired',
    dimensions: 'Ø12cm × H8cm',
    weight: '320g',
    care: 'Hand wash. Avoid microwave use. Dry fully before storage.',
    pricing: createPricing(11800),
    shipping: compactShipping,
    stockStatus: 'low-stock',
    stockCount: 3,
    images: [
      { url: img('kuro-oribe-1', 900, 1125), alt: 'Dark green tea bowl with irregular rim on a pale wooden surface.' },
      { url: img('kuro-oribe-2', 900, 1125), alt: 'Side view of a tea bowl showing ash glaze variation in bright light.' },
      { url: img('kuro-oribe-3', 900, 1125), alt: 'Tea bowl interior with layered glaze tones.' }
    ],
    makerNotes:
      'This bowl was sized for a calm, daily whisking rhythm rather than formal presentation.',
    collections: ['tea-ceremony-essentials', 'summer-table'],
    releaseOrder: 1
  },
  {
    id: 'morning-mist-serving-plate',
    name: 'Morning Mist Serving Plate',
    makerId: 'akari-kiln',
    category: 'tableware',
    origin: 'Kyoto Prefecture',
    description:
      'A broad serving plate with a washed celadon-grey surface and low profile. Designed to frame fruit, grilled fish, or pastries without overpowering the table.',
    story:
      'This plate begins as a wide, open form that is compressed carefully to keep the center stable. Akari Kiln uses a pale mineral slip under a translucent glaze so the surface reads cool and luminous instead of glossy.\n\nThe edge is kept thin enough to feel elegant but not fragile. Small spiral traces from the throwing stage are intentionally preserved under the glaze as a reminder of how the form was opened.\n\nMorning Mist works especially well in layered table settings because it leaves generous negative space around food.',
    materials: ['Stoneware clay', 'Mineral slip', 'Transparent glaze'],
    technique: 'Wheel thrown and reduction fired',
    dimensions: 'Ø24cm × H3cm',
    weight: '640g',
    care: 'Dishwasher safe on gentle cycles, though hand washing is preferred.',
    pricing: createPricing(14200),
    shipping: mediumShipping,
    stockStatus: 'in-stock',
    stockCount: 8,
    images: [
      { url: img('morning-mist-1', 900, 1125), alt: 'Wide ceramic serving plate on a white linen table.' },
      { url: img('morning-mist-2', 900, 1125), alt: 'Close detail of a pale glazed plate edge.' },
      { url: img('morning-mist-3', 900, 1125), alt: 'Serving plate styled with citrus and leaves.' }
    ],
    collections: ['summer-table'],
    releaseOrder: 2
  },
  {
    id: 'limited-raku-bowl',
    name: 'Limited Raku Bowl',
    makerId: 'akari-kiln',
    category: 'tea-ritual',
    origin: 'Kyoto Prefecture',
    description:
      'A sculptural raku bowl from a short seasonal firing, offered through split inventory: part fixed-price, part auction. The surface moves between smoky charcoal and quiet amber.',
    story:
      'The Limited Raku Bowl is formed thicker than Akari Kiln’s daily wares so the walls can hold dramatic variation during the raku pull. After the firing, the bowl is allowed to cool naturally, which preserves subtle smoke fields and softened metallic notes.\n\nBecause demand for this release tends to spike sharply, Takumi Market allocates only part of the batch to auction while leaving the remainder available at a fixed price. The goal is to let collectors compete for a few pieces without erasing access for buyers who simply want the object.\n\nNo two bowls match exactly. Variation is the entire point of the release.',
    materials: ['Raku clay body', 'Copper glaze', 'Smoke finish'],
    technique: 'Hand shaped and raku fired',
    dimensions: 'Ø14cm × H9cm',
    weight: '360g',
    care: 'Hand wash only. Avoid prolonged soaking and abrupt temperature changes.',
    pricing: createPricing(18600),
    shipping: compactShipping,
    stockStatus: 'low-stock',
    stockCount: 5,
    images: [
      { url: img('limited-raku-1', 900, 1125), alt: 'Raku tea bowl with smoky charcoal glaze on a pale pedestal.' },
      { url: img('limited-raku-2', 900, 1125), alt: 'Close view of raku bowl surface with dark and amber tones.' },
      { url: img('limited-raku-3', 900, 1125), alt: 'Raku bowl seen from above with atmospheric glazing.' }
    ],
    makerNotes:
      'These bowls are meant to look a little unstable in the best way. They should feel alive from every angle.',
    auctionId: 'limited-raku-bowl-drop',
    collections: ['tea-ceremony-essentials'],
    releaseOrder: 3
  },
  {
    id: 'stoneware-matcha-chawan',
    name: 'Stoneware Matcha Chawan',
    makerId: 'akari-kiln',
    category: 'tea-ritual',
    origin: 'Kyoto Prefecture',
    description:
      'A lighter, everyday matcha bowl with warm oat glaze and a broad interior for easy whisking.',
    story:
      'Compared with the studio’s darker tea bowls, this chawan keeps the mood lighter and more open. The oat-toned glaze throws soft shadows that flatter bright tea and pale tables alike.\n\nIt is made for frequency rather than ceremony. The proportions favor quick cleaning, steady stacking, and comfort in the hand.\n\nThe result is a tea bowl that invites use without feeling casual.',
    materials: ['Stoneware clay', 'Oat glaze'],
    technique: 'Wheel thrown',
    dimensions: 'Ø13cm × H7.5cm',
    weight: '300g',
    care: 'Hand wash recommended.',
    pricing: createPricing(9200),
    shipping: compactShipping,
    stockStatus: 'made-to-order',
    images: [
      { url: img('chawan-1', 900, 1125), alt: 'Warm oat-glazed matcha bowl on white linen.' },
      { url: img('chawan-2', 900, 1125), alt: 'Interior of a pale stoneware matcha bowl.' },
      { url: img('chawan-3', 900, 1125), alt: 'Matcha bowl with whisk and tea scoop nearby.' }
    ],
    collections: ['tea-ceremony-essentials'],
    releaseOrder: 4
  },
  {
    id: 'sakai-gyuto-chef-knife',
    name: 'Sakai Gyuto Chef Knife',
    makerId: 'takeshi-hamono',
    category: 'kitchen-tools',
    origin: 'Osaka Prefecture',
    description:
      'A balanced 210mm gyuto with carbon steel core, walnut handle, and a satin finish tuned for home and professional kitchens.',
    story:
      'This gyuto is forged with a carbon steel core clad in stainless, giving the edge character without asking the user for excessive maintenance. Takeshi Hamono shapes the blade for clean draw cuts and a predictable rocking motion.\n\nThe walnut octagonal handle is tuned for a neutral grip, with enough warmth and texture to feel secure even in a busy prep session. Final sharpening favors ease of use over theatrical thinness.\n\nIt is the anchor knife in the collection: versatile, composed, and deeply practical.',
    materials: ['Aogami carbon steel core', 'Stainless cladding', 'Walnut handle'],
    technique: 'Forged, heat treated, and hand sharpened',
    dimensions: 'Blade 210mm',
    weight: '178g',
    care: 'Hand wash and dry immediately. Oil blade lightly after acidic prep.',
    pricing: createPricing(32400),
    shipping: mediumShipping,
    stockStatus: 'in-stock',
    stockCount: 6,
    images: [
      { url: img('gyuto-1', 900, 1125), alt: 'Chef knife with walnut handle on a pale cutting board.' },
      { url: img('gyuto-2', 900, 1125), alt: 'Close-up of knife blade and handle junction.' },
      { url: img('gyuto-3', 900, 1125), alt: 'Chef knife laid beside vegetables in bright kitchen light.' }
    ],
    collections: ['first-kitchen'],
    releaseOrder: 5
  },
  {
    id: 'walnut-petty-knife',
    name: 'Walnut Petty Knife',
    makerId: 'takeshi-hamono',
    category: 'kitchen-tools',
    origin: 'Osaka Prefecture',
    description:
      'A nimble 135mm petty knife for fruit, herbs, and detailed prep. Light in the hand and easy to maintain.',
    story:
      'The Walnut Petty Knife is designed for the in-between work that determines whether a tool becomes indispensable. It handles herbs, shallots, citrus, and trimming with very little effort.\n\nTakeshi Hamono tempers the blade for daily use and sharpens it with a modest, reliable profile so owners can keep it performing without specialized skill.\n\nIt is a first serious knife for some buyers and a constant companion for experienced cooks.',
    materials: ['Carbon steel', 'Walnut handle'],
    technique: 'Forged and hand sharpened',
    dimensions: 'Blade 135mm',
    weight: '92g',
    care: 'Hand wash and dry immediately.',
    pricing: createPricing(18600),
    shipping: compactShipping,
    stockStatus: 'in-stock',
    stockCount: 10,
    images: [
      { url: img('petty-1', 900, 1125), alt: 'Small walnut-handled knife on a white prep cloth.' },
      { url: img('petty-2', 900, 1125), alt: 'Petty knife blade detail with satin finish.' },
      { url: img('petty-3', 900, 1125), alt: 'Petty knife styled with citrus and herbs.' }
    ],
    collections: ['first-kitchen'],
    releaseOrder: 6
  },
  {
    id: 'carbon-steel-bread-knife',
    name: 'Carbon Steel Bread Knife',
    makerId: 'takeshi-hamono',
    category: 'kitchen-tools',
    origin: 'Osaka Prefecture',
    description:
      'A serrated long blade with calm balance and a narrow profile for breads and crusted pastries.',
    story:
      'Bread knives often disappear into generic utility, but Takeshi Hamono gives this one the same attention as the chef knives. The blade is narrow enough to feel controlled, while the serration profile is cut to tear less and glide more.\n\nIt is particularly good for country loaves, laminated pastries, and tall sandwiches because the blade remains steady through the cut.\n\nThe finish is intentionally understated, letting the knife read as a working tool rather than a trophy.',
    materials: ['Carbon steel', 'Ho wood handle'],
    technique: 'Stamped, ground, and hand finished',
    dimensions: 'Blade 250mm',
    weight: '160g',
    care: 'Hand wash and dry immediately.',
    pricing: createPricing(21200),
    shipping: mediumShipping,
    stockStatus: 'made-to-order',
    images: [
      { url: img('bread-1', 900, 1125), alt: 'Long bread knife against a pale countertop.' },
      { url: img('bread-2', 900, 1125), alt: 'Bread knife serrations in close detail.' },
      { url: img('bread-3', 900, 1125), alt: 'Bread knife with sliced loaf in natural light.' }
    ],
    collections: ['first-kitchen'],
    releaseOrder: 7
  },
  {
    id: 'kiridashi-marking-knife',
    name: 'Kiridashi Marking Knife',
    makerId: 'takeshi-hamono',
    category: 'home-objects',
    origin: 'Osaka Prefecture',
    description:
      'A compact utility blade for studio desks, paper, packaging, and careful everyday tasks.',
    story:
      'Originally a marking tool, the kiridashi translates beautifully to desks and studios. It opens parcels, scores paper, and handles small adjustments with much more composure than a disposable cutter.\n\nTakeshi Hamono finishes the blade with a fine satin texture and keeps the overall form restrained so it sits comfortably in a drawer or on a tray.\n\nIt is a small object with a clear sense of purpose.',
    materials: ['Carbon steel'],
    technique: 'Forged and hand sharpened',
    dimensions: 'Overall length 15cm',
    weight: '54g',
    care: 'Wipe dry after use.',
    pricing: createPricing(8600),
    shipping: compactShipping,
    stockStatus: 'low-stock',
    stockCount: 2,
    images: [
      { url: img('kiridashi-1', 900, 1125), alt: 'Compact marking knife on a pale desk surface.' },
      { url: img('kiridashi-2', 900, 1125), alt: 'Kiridashi blade in close detail.' },
      { url: img('kiridashi-3', 900, 1125), alt: 'Marking knife with paper and twine.' }
    ],
    collections: [],
    releaseOrder: 8
  },
  {
    id: 'indigo-table-runner',
    name: 'Indigo Table Runner',
    makerId: 'kurashiki-textile-mill',
    category: 'textiles',
    origin: 'Okayama Prefecture',
    description:
      'A woven linen runner with a softened indigo field and airy drape, sized for a six-seat table.',
    story:
      'Kurashiki Textile Mill wove this runner with alternating warp density so the fabric sits flat while still moving gently at the edges. The indigo tone is washed back slightly to keep it bright rather than heavy.\n\nIt works across seasons because the weave carries enough texture to feel warm, yet enough openness to read cool in summer light.\n\nThe piece is finished with narrow hems that sit cleanly without stiffening the cloth.',
    materials: ['Belgian linen', 'Mineral dye'],
    technique: 'Loom woven and washed',
    dimensions: '45cm × 180cm',
    weight: '260g',
    care: 'Cold wash, line dry.',
    pricing: createPricing(13200),
    shipping: compactShipping,
    stockStatus: 'in-stock',
    stockCount: 11,
    images: [
      { url: img('runner-1', 900, 1125), alt: 'Indigo linen table runner on a bright dining table.' },
      { url: img('runner-2', 900, 1125), alt: 'Close-up weave detail of indigo table runner.' },
      { url: img('runner-3', 900, 1125), alt: 'Table runner layered with ceramics and glassware.' }
    ],
    collections: ['summer-table'],
    releaseOrder: 9
  },
  {
    id: 'linen-noren-panel',
    name: 'Linen Noren Panel',
    makerId: 'kurashiki-textile-mill',
    category: 'textiles',
    origin: 'Okayama Prefecture',
    description:
      'A light-filtering linen panel designed for doorways, shelves, and room-softening partitions.',
    story:
      'The Linen Noren Panel is woven to diffuse light rather than block it outright. Kurashiki Textile Mill uses a slightly open structure so air and brightness still travel through the cloth.\n\nIt is weighted just enough to hang cleanly, with a center split that moves easily without looking theatrical.\n\nThe color stays deliberately quiet so the fabric reads as architecture rather than decoration.',
    materials: ['Linen', 'Cotton tab header'],
    technique: 'Loom woven and hand finished',
    dimensions: '90cm × 150cm',
    weight: '340g',
    care: 'Cold wash, reshape while damp.',
    pricing: createPricing(16800),
    shipping: mediumShipping,
    stockStatus: 'in-stock',
    stockCount: 5,
    images: [
      { url: img('noren-1', 900, 1125), alt: 'Pale linen noren panel hanging in a bright interior.' },
      { url: img('noren-2', 900, 1125), alt: 'Texture detail of linen doorway panel.' },
      { url: img('noren-3', 900, 1125), alt: 'Noren panel filtering daylight in a minimal home.' }
    ],
    collections: [],
    releaseOrder: 10
  },
  {
    id: 'sashiko-cushion-cover',
    name: 'Sashiko Cushion Cover',
    makerId: 'kurashiki-textile-mill',
    category: 'home-objects',
    origin: 'Okayama Prefecture',
    description:
      'A square cushion cover woven from washed cotton-linen and stitched with restrained sashiko patterning.',
    story:
      'This cover starts with a durable cotton-linen base chosen for everyday use. The sashiko pattern is kept tonal and controlled, adding structure without turning the piece into a graphic accent.\n\nKurashiki Textile Mill uses a concealed closure so the form stays clean from every angle.\n\nIt is best used where you want texture to register gradually rather than instantly.',
    materials: ['Cotton-linen blend', 'Cotton thread'],
    technique: 'Loom woven and sashiko stitched',
    dimensions: '45cm × 45cm',
    weight: '180g',
    care: 'Machine wash cold inside out.',
    pricing: createPricing(9800),
    shipping: compactShipping,
    stockStatus: 'sold-out',
    images: [
      { url: img('cushion-1', 900, 1125), alt: 'Textured cushion cover on a pale sofa.' },
      { url: img('cushion-2', 900, 1125), alt: 'Sashiko stitch detail on a cushion cover.' },
      { url: img('cushion-3', 900, 1125), alt: 'Cushion cover folded beside linen textiles.' }
    ],
    collections: [],
    releaseOrder: 11
  },
  {
    id: 'moon-white-letter-set',
    name: 'Moon White Letter Set',
    makerId: 'echizen-washi-studio',
    category: 'paper-goods',
    origin: 'Fukui Prefecture',
    description:
      'A writing set of eight deckled letter sheets and lined envelopes in luminous kozo paper.',
    story:
      'This set uses a medium-weight kozo sheet with enough body to feel ceremonial without becoming stiff. Echizen Washi Studio leaves the surface minimally sized so fountain pen ink settles crisply while pencil keeps a slight tooth.\n\nThe envelopes are lined to keep the letter silhouettes soft and private in bright light. Deckled edges remain clean and intentional rather than exaggerated.\n\nIt is a giftable paper set that still feels serious enough for actual correspondence.',
    materials: ['Kozo fiber paper', 'Cotton lining paper'],
    technique: 'Sheet formed and hand torn',
    dimensions: 'A5 sheets',
    weight: '8 sheets + 8 envelopes',
    care: 'Store flat and dry.',
    pricing: createPricing(7400),
    shipping: compactShipping,
    stockStatus: 'in-stock',
    stockCount: 18,
    images: [
      { url: img('letterset-1', 900, 1125), alt: 'Bright handmade letter set with envelopes on a white desk.' },
      { url: img('letterset-2', 900, 1125), alt: 'Deckled paper edges shown in close detail.' },
      { url: img('letterset-3', 900, 1125), alt: 'Letter set with pen and folded note in daylight.' }
    ],
    collections: [],
    releaseOrder: 12
  },
  {
    id: 'washi-ledger-journal',
    name: 'Washi Ledger Journal',
    makerId: 'echizen-washi-studio',
    category: 'paper-goods',
    origin: 'Fukui Prefecture',
    description:
      'A thread-bound journal with heavyweight washi pages sized for sketching, lists, and correspondence drafts.',
    story:
      'The Washi Ledger Journal is built around a substantial sheet that can handle graphite, ink, and light wash without buckling. The cover is intentionally spare, letting the tactile quality of the paper do most of the work.\n\nThread binding allows the book to open wide on a desk while staying light in the hand. Subtle ruling guides the page without dominating it.\n\nIt is meant to become a workhorse object, not a precious keepsake.',
    materials: ['Kozo paper', 'Board cover', 'Cotton thread'],
    technique: 'Hand bound',
    dimensions: '19cm × 24cm',
    weight: '480g',
    care: 'Store away from moisture and direct sun.',
    pricing: createPricing(11200),
    shipping: compactShipping,
    stockStatus: 'in-stock',
    stockCount: 9,
    images: [
      { url: img('journal-1', 900, 1125), alt: 'Thread-bound paper journal on a pale desk.' },
      { url: img('journal-2', 900, 1125), alt: 'Journal spine and page detail in bright light.' },
      { url: img('journal-3', 900, 1125), alt: 'Open washi journal with soft ruling and writing tools.' }
    ],
    collections: [],
    releaseOrder: 13
  },
  {
    id: 'kozo-paper-lantern',
    name: 'Kozo Paper Lantern',
    makerId: 'echizen-washi-studio',
    category: 'home-objects',
    origin: 'Fukui Prefecture',
    description:
      'A tabletop lantern with softly glowing kozo paper skin and a minimal ash wood base.',
    story:
      'Echizen Washi Studio designed this lantern to make paper behave like atmosphere. The kozo shade diffuses light evenly, leaving no hot spots and very little visual noise.\n\nThe base is compact and neutral so the paper remains the primary event. When switched off, the lantern still reads as a composed object rather than a placeholder for light.\n\nIt is especially effective in entryways, bedside settings, and shelves where warm glow matters more than brightness.',
    materials: ['Kozo paper', 'Ash wood base', 'LED module'],
    technique: 'Hand formed paper shade',
    dimensions: 'Ø16cm × H28cm',
    weight: '650g',
    care: 'Dust with a dry cloth. Keep away from moisture.',
    pricing: createPricing(19600),
    shipping: largeShipping,
    stockStatus: 'made-to-order',
    images: [
      { url: img('lantern-1', 900, 1125), alt: 'Paper lantern glowing softly on a pale shelf.' },
      { url: img('lantern-2', 900, 1125), alt: 'Close-up of kozo paper texture on a lantern shade.' },
      { url: img('lantern-3', 900, 1125), alt: 'Lantern off, showing sculptural paper form in daylight.' }
    ],
    collections: ['tea-ceremony-essentials'],
    releaseOrder: 14
  },
  {
    id: 'hinoki-serving-board',
    name: 'Hinoki Serving Board',
    makerId: 'hida-woodcraft',
    category: 'kitchen-tools',
    origin: 'Gifu Prefecture',
    description:
      'A slim hinoki board for bread, fruit, or cheese service with a pale grain and softened chamfer.',
    story:
      'This board is cut from hinoki selected for straight grain and a clean scent profile. Hida Woodcraft keeps the thickness modest so the piece feels elegant rather than heavy, then rounds the underside edge to lift it visually from the table.\n\nThe surface is finished with food-safe oil and lightly burnished to preserve tactile warmth.\n\nIt is meant for serving rather than aggressive chopping, which lets the grain remain calm and open over time.',
    materials: ['Hinoki cypress', 'Food-safe oil'],
    technique: 'Cut, planed, and oil finished',
    dimensions: '18cm × 42cm × 1.4cm',
    weight: '510g',
    care: 'Hand wash and dry upright. Oil occasionally.',
    pricing: createPricing(12400),
    shipping: mediumShipping,
    stockStatus: 'in-stock',
    stockCount: 7,
    images: [
      { url: img('board-1', 900, 1125), alt: 'Pale hinoki serving board on a white table.' },
      { url: img('board-2', 900, 1125), alt: 'Serving board edge detail with visible grain.' },
      { url: img('board-3', 900, 1125), alt: 'Hinoki board styled with bread and citrus.' }
    ],
    collections: ['summer-table', 'first-kitchen'],
    releaseOrder: 15
  },
  {
    id: 'curved-tea-tray',
    name: 'Curved Tea Tray',
    makerId: 'hida-woodcraft',
    category: 'tea-ritual',
    origin: 'Gifu Prefecture',
    description:
      'A steam-bent chestnut tray with raised edge and generous negative space for tea service.',
    story:
      'The Curved Tea Tray is steam bent from chestnut so the side profile stays light and continuous. Hida Woodcraft keeps the edge low, just enough to contain cups and snacks without turning the tray into a box.\n\nThe finish is matte and tactile, meant to register as wood rather than coating.\n\nIt pairs naturally with ceramics and paper because the tray is visually quiet while still clearly made.',
    materials: ['Japanese chestnut', 'Natural oil finish'],
    technique: 'Steam bent and hand finished',
    dimensions: '28cm × 38cm × 2.5cm',
    weight: '620g',
    care: 'Wipe clean and re-oil as needed.',
    pricing: createPricing(15800),
    shipping: mediumShipping,
    stockStatus: 'low-stock',
    stockCount: 2,
    images: [
      { url: img('tea-tray-1', 900, 1125), alt: 'Bent wood tea tray holding cups on a pale surface.' },
      { url: img('tea-tray-2', 900, 1125), alt: 'Detail of curved tray rim and wood grain.' },
      { url: img('tea-tray-3', 900, 1125), alt: 'Tea tray styled with ceramics and folded paper.' }
    ],
    collections: ['tea-ceremony-essentials', 'summer-table'],
    releaseOrder: 16
  },
  {
    id: 'joinery-stool',
    name: 'Joinery Stool',
    makerId: 'hida-woodcraft',
    category: 'home-objects',
    origin: 'Gifu Prefecture',
    description:
      'A compact oak stool with visible joinery, useful as seating, plant stand, or bedside table.',
    story:
      'This stool is scaled to remain useful in small homes and flexible interiors. Hida Woodcraft lets the joinery stay visible so the construction reads as part of the design rather than something to hide.\n\nThe oak is sanded lightly to preserve tactile grain, then finished with a matte oil that will age toward a warmer tone.\n\nIt is an object that earns its place slowly through repeated use.',
    materials: ['White oak', 'Natural oil finish'],
    technique: 'Joinery and hand planing',
    dimensions: '32cm × 32cm × H42cm',
    weight: '3.8kg',
    care: 'Wipe with a soft cloth. Re-oil once or twice a year.',
    pricing: createPricing(28400),
    shipping: largeShipping,
    stockStatus: 'made-to-order',
    images: [
      { url: img('stool-1', 900, 1125), alt: 'Oak stool in a bright minimal interior.' },
      { url: img('stool-2', 900, 1125), alt: 'Joinery detail on a wooden stool corner.' },
      { url: img('stool-3', 900, 1125), alt: 'Wooden stool styled beside books and a lantern.' }
    ],
    collections: [],
    releaseOrder: 17
  },
  {
    id: 'hammered-brass-tea-kettle',
    name: 'Hammered Brass Tea Kettle',
    makerId: 'tsubame-metalworks',
    category: 'tea-ritual',
    origin: 'Niigata Prefecture',
    description:
      'A softly reflective brass kettle with hammered finish and limited seasonal release. Split between direct purchase and auction allocation.',
    story:
      'Tsubame Metalworks uses a shallow hammer pattern so the kettle catches light delicately instead of glittering. The handle arc is proportioned to feel calm in profile, while the body holds enough volume for shared tea service.\n\nBecause the release is tightly capped, Takumi Market allocates a portion of the batch to auction and leaves the remainder at a fixed price. That keeps the excitement contained instead of turning the whole run into speculation.\n\nThe kettle is as much about presence on a shelf as it is about service at the table.',
    materials: ['Hammered brass', 'Heat-safe handle wrap'],
    technique: 'Press formed, hammered, and hand finished',
    dimensions: '1.1L capacity',
    weight: '860g',
    care: 'Wipe dry. Polish lightly if desired, or allow the surface to mellow naturally.',
    pricing: createPricing(36200),
    shipping: largeShipping,
    stockStatus: 'low-stock',
    stockCount: 4,
    images: [
      { url: img('kettle-1', 900, 1125), alt: 'Hammered brass kettle in bright natural light.' },
      { url: img('kettle-2', 900, 1125), alt: 'Close-up of hammered brass surface detail.' },
      { url: img('kettle-3', 900, 1125), alt: 'Brass kettle styled on a pale tea tray.' }
    ],
    auctionId: 'brass-kettle-reserve-release',
    collections: ['tea-ceremony-essentials'],
    releaseOrder: 18
  },
  {
    id: 'coffee-drip-stand',
    name: 'Coffee Drip Stand',
    makerId: 'tsubame-metalworks',
    category: 'home-objects',
    origin: 'Niigata Prefecture',
    description:
      'A compact stainless steel pour-over stand with brushed finish and slim footprint.',
    story:
      'The Coffee Drip Stand keeps its geometry simple: a slender frame, stable base, and enough height for servers or mugs. Tsubame Metalworks brushes the surface to diffuse reflections and prevent the stand from feeling industrial or cold.\n\nIt is easy to store, easy to wipe down, and composed enough to leave out between brews.\n\nA good coffee tool should add rhythm to a routine without adding bulk.',
    materials: ['Stainless steel'],
    technique: 'Cut, formed, and brushed',
    dimensions: '14cm × 12cm × H18cm',
    weight: '410g',
    care: 'Wipe clean with a soft cloth.',
    pricing: createPricing(14400),
    shipping: mediumShipping,
    stockStatus: 'in-stock',
    stockCount: 12,
    images: [
      { url: img('drip-1', 900, 1125), alt: 'Brushed stainless coffee stand on a white counter.' },
      { url: img('drip-2', 900, 1125), alt: 'Detail of coffee stand frame and brushed finish.' },
      { url: img('drip-3', 900, 1125), alt: 'Coffee stand with dripper and carafe in daylight.' }
    ],
    collections: ['first-kitchen'],
    releaseOrder: 19
  },
  {
    id: 'nesting-incense-tray',
    name: 'Nesting Incense Tray',
    makerId: 'tsubame-metalworks',
    category: 'home-objects',
    origin: 'Niigata Prefecture',
    description:
      'A slim brushed brass tray with nested rest for incense sticks and small objects.',
    story:
      'This tray was designed to stay visually useful even when empty. The shallow curve catches ash neatly, while the separate rest piece can be moved or removed as needed.\n\nTsubame Metalworks keeps the finish brushed and pale so the brass feels modern and airy rather than antique. The form is intentionally minimal, giving scent and smoke room to lead.\n\nIt is small enough for shelves, desks, or bedside settings.',
    materials: ['Brass'],
    technique: 'Press formed and brushed',
    dimensions: '24cm × 5cm',
    weight: '180g',
    care: 'Brush out ash and wipe with a dry cloth.',
    pricing: createPricing(8600),
    shipping: compactShipping,
    stockStatus: 'in-stock',
    stockCount: 15,
    images: [
      { url: img('incense-1', 900, 1125), alt: 'Slim brass incense tray on pale stone.' },
      { url: img('incense-2', 900, 1125), alt: 'Close-up of brushed brass incense tray.' },
      { url: img('incense-3', 900, 1125), alt: 'Incense tray styled with paper and ceramics.' }
    ],
    collections: [],
    releaseOrder: 20
  }
]

