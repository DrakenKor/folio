import { Maker } from '../types'

const img = (seed: string, _width: number, _height: number) =>
  `/takumi-market-demo/images/makers/${seed}.jpg`

export const makers: Maker[] = [
  {
    id: 'akari-kiln',
    name: 'Akari Kiln',
    location: 'Uji, Kyoto Prefecture',
    craft: 'Ceramics',
    tagline: 'Wood-fired stoneware shaped for quiet daily rituals.',
    accentColor: '#6B8CBA',
    story:
      'We work just outside Uji, where tea culture has trained the eye to notice surface, steam, and pause. Every bowl and plate is thrown with daily handling in mind: a foot that sits cleanly on wood, a lip that feels softened by use, a glaze that shifts as light moves across it.\n\nTakumi Market lets us show the kiln room, ash, and trimming marks instead of flattening everything into SKU copy. That matters. Buyers are not just receiving an object; they are entering the atmosphere that formed it.',
    pullQuote: 'A bowl should feel calm before it ever holds tea.',
    founded: 1988,
    milestones: [
      { year: 1988, event: 'Akari Kiln founded on the eastern edge of Uji.' },
      { year: 2007, event: 'Introduced a small-batch wood-firing calendar for export buyers.' },
      { year: 2021, event: 'Third-generation studio stewardship begins.' },
      { year: 2024, event: 'Joined Takumi Market.' }
    ],
    materials: ['Iron-rich stoneware clay', 'Rice-straw ash glaze', 'Natural feldspar slips'],
    techniques: ['Wheel throwing', 'Hand trimming', 'Wood-fired kiln'],
    heroImage: {
      url: img('akari-hero', 1600, 900),
      alt: 'Sunlit ceramics studio with pale shelves, clay vessels, and a worktable by a large window.'
    },
    processImages: [
      {
        url: img('akari-process-1', 960, 640),
        alt: 'Hands centering clay on a pottery wheel.',
        caption: 'Centering clay at first light before the kiln schedule begins.'
      },
      {
        url: img('akari-process-2', 960, 640),
        alt: 'Freshly trimmed tea bowls drying on pale wooden boards.',
        caption: 'Trimmed forms resting before glaze testing.'
      },
      {
        url: img('akari-process-3', 960, 640),
        alt: 'Shelves of ceramics with daylight moving across pale walls.',
        caption: 'Daylight tells us more about a glaze than studio lamps ever will.'
      },
      {
        url: img('akari-process-4', 960, 640),
        alt: 'Kiln door partially open with warm tones inside.',
        caption: 'Wood-firing introduces subtle drift in every surface.'
      }
    ],
    makerNotes:
      'Thank you for making room in your home for slow objects. We like pieces that become quieter as they are used.',
    verified: true,
    verifiedDate: '2024-09',
    quote: 'The kiln gives the last word, but the table decides whether a piece belongs.',
    heritage:
      'Uji’s tea heritage shapes how the studio thinks about restraint, tactility, and objects meant to be revisited daily.'
  },
  {
    id: 'takeshi-hamono',
    name: 'Takeshi Hamono',
    location: 'Sakai, Osaka Prefecture',
    craft: 'Kitchen Knives',
    tagline: 'Balanced cutting tools forged for cooks who respect repetition.',
    accentColor: '#C4836A',
    story:
      'Sakai taught us that sharpness is only half the work; the other half is composure. Our knives are tuned for balance at the pinch grip, clear edge geometry, and handles that never ask for attention.\n\nWe use Takumi Market to explain steel, heat treatment, and edge maintenance without intimidating buyers. Good tools become approachable when the making is described plainly.',
    pullQuote: 'A serious knife should cut cleanly and disappear from your hand.',
    founded: 1972,
    milestones: [
      { year: 1972, event: 'Workshop established by a former industrial sharpener.' },
      { year: 1998, event: 'Shifted fully to small-batch chef and petty knives.' },
      { year: 2019, event: 'Expanded handle work with local walnut and ho wood.' },
      { year: 2024, event: 'Joined Takumi Market.' }
    ],
    materials: ['Aogami carbon steel', 'Stainless clad steel', 'Walnut', 'Ho wood'],
    techniques: ['Forging', 'Heat treatment', 'Hand sharpening', 'Handle fitting'],
    heroImage: {
      url: img('takeshi-hero', 1600, 900),
      alt: 'Bright workshop bench with knife blanks, sharpening stones, and window light.'
    },
    processImages: [
      {
        url: img('takeshi-process-1', 960, 640),
        alt: 'Knife blank on a pale workbench beside tools.',
        caption: 'Edge geometry is set gradually, not forced all at once.'
      },
      {
        url: img('takeshi-process-2', 960, 640),
        alt: 'Sharpening stones and a blade catching light.',
        caption: 'Final sharpening is about consistency over spectacle.'
      },
      {
        url: img('takeshi-process-3', 960, 640),
        alt: 'Wood handles laid out in a workshop.',
        caption: 'Handle woods are chosen to stay quiet and durable over time.'
      },
      {
        url: img('takeshi-process-4', 960, 640),
        alt: 'Craftsperson polishing a knife near a window.',
        caption: 'Natural light exposes scratches that indoor light hides.'
      }
    ],
    makerNotes:
      'I want a cook to reach for the same knife on an ordinary Tuesday and still feel it was worth making carefully.',
    verified: true,
    verifiedDate: '2024-08',
    quote: 'Precision should feel reassuring, not precious.',
    heritage:
      'Sakai’s long knife-making history informs the workshop’s preference for clean edges, practical balance, and disciplined finishing.'
  },
  {
    id: 'kurashiki-textile-mill',
    name: 'Kurashiki Textile Mill',
    location: 'Kurashiki, Okayama Prefecture',
    craft: 'Textiles',
    tagline: 'Loom-woven linens and cottons with structure, air, and softness.',
    accentColor: '#C4929B',
    story:
      'Our fabrics are designed around how homes actually change through a day: morning glare, steam, washing, folding, and the touch of skin. We favor yarns that soften without losing shape and colors that lift a room without dominating it.\n\nTakumi Market gives us space to pair textiles with context: where fibers come from, how the loom is set, and how a piece should age in use. That kind of explanation creates trust without crowding the page.',
    pullQuote: 'Textiles should diffuse a room the way daylight does.',
    founded: 1964,
    milestones: [
      { year: 1964, event: 'Family weaving mill established in Kurashiki.' },
      { year: 2003, event: 'Shifted from bulk yardage to finished small-batch home textiles.' },
      { year: 2018, event: 'Introduced indigo and rose mineral dye experiments.' },
      { year: 2024, event: 'Joined Takumi Market.' }
    ],
    materials: ['Belgian linen', 'Organic cotton', 'Mineral dyes'],
    techniques: ['Loom weaving', 'Yarn washing', 'Piece dyeing', 'Hand finishing'],
    heroImage: {
      url: img('kurashiki-hero', 1600, 900),
      alt: 'Loom room with soft daylight, rolled textiles, and pale wood surfaces.'
    },
    processImages: [
      {
        url: img('kurashiki-process-1', 960, 640),
        alt: 'Close view of loom threads in a bright studio.',
        caption: 'Thread density is adjusted depending on how much drape we want.'
      },
      {
        url: img('kurashiki-process-2', 960, 640),
        alt: 'Folded table linens in muted rose and neutral tones.',
        caption: 'Color checks always happen in diffuse daylight.'
      },
      {
        url: img('kurashiki-process-3', 960, 640),
        alt: 'Hands smoothing fabric on a large table.',
        caption: 'Edges are hand-finished so the cloth sits cleanly on a table.'
      },
      {
        url: img('kurashiki-process-4', 960, 640),
        alt: 'Rolled linen beside a window.',
        caption: 'The final wash opens the hand of the cloth.'
      }
    ],
    makerNotes:
      'Homes are full of hard surfaces. Cloth is one of the simplest ways to add gentleness without adding clutter.',
    verified: true,
    verifiedDate: '2024-10',
    quote: 'We design softness with discipline.',
    heritage:
      'Kurashiki’s legacy of mills and merchant houses informs the studio’s practical approach to durable, beautiful household cloth.'
  },
  {
    id: 'echizen-washi-studio',
    name: 'Echizen Washi Studio',
    location: 'Echizen, Fukui Prefecture',
    craft: 'Paper Craft',
    tagline: 'Kozo paper goods with crisp edges and luminous texture.',
    accentColor: '#8BAF92',
    story:
      'Paper is often treated like a background material. We prefer to make it the event: the deckled edge, the way ink settles, the brightness of fibers against daylight. Our stationery and home pieces are meant to feel exact, quiet, and alive in the hand.\n\nOn Takumi Market we can explain fiber sources, sheet weight, and making methods without turning the page into technical clutter. The result feels more honest for both gift buyers and collectors.',
    pullQuote: 'Paper carries light before it carries words.',
    founded: 1991,
    milestones: [
      { year: 1991, event: 'Studio founded near Echizen’s papermaking district.' },
      { year: 2012, event: 'Expanded into paper lighting and archival stationery.' },
      { year: 2020, event: 'Introduced fiber traceability notes for every batch.' },
      { year: 2024, event: 'Joined Takumi Market.' }
    ],
    materials: ['Kozo fiber', 'Mitsumata fiber', 'Natural starch sizing'],
    techniques: ['Sheet forming', 'Pressing', 'Air drying', 'Hand tearing'],
    heroImage: {
      url: img('echizen-hero', 1600, 900),
      alt: 'Paper studio with stacked sheets, moulds, and bright indirect light.'
    },
    processImages: [
      {
        url: img('echizen-process-1', 960, 640),
        alt: 'Paper sheets drying on boards in a white studio.',
        caption: 'Drying reveals the tone and openness of the fibers.'
      },
      {
        url: img('echizen-process-2', 960, 640),
        alt: 'Handmade paper samples arranged on a pale table.',
        caption: 'We keep multiple weights so the right paper meets the right use.'
      },
      {
        url: img('echizen-process-3', 960, 640),
        alt: 'Fibers and deckled edges shown in close detail.',
        caption: 'The edge should feel intentional, never decorative by default.'
      },
      {
        url: img('echizen-process-4', 960, 640),
        alt: 'Lantern paper glowing softly in daylight.',
        caption: 'Translucency matters as much as texture for lighting pieces.'
      }
    ],
    makerNotes:
      'Paper rewards attention quickly. You notice it the moment you write, fold, or switch on a lamp.',
    verified: true,
    verifiedDate: '2024-07',
    quote: 'Precision can still feel feather-light.',
    heritage:
      'Echizen’s papermaking tradition influences the studio’s emphasis on fiber integrity, translucency, and measured detail.'
  },
  {
    id: 'hida-woodcraft',
    name: 'Hida Woodcraft',
    location: 'Takayama, Gifu Prefecture',
    craft: 'Woodwork',
    tagline: 'Calm utility objects carved from hinoki, chestnut, and oak.',
    accentColor: '#B89B7A',
    story:
      'We make boards, trays, and small furniture with the grain left legible. The point is not rusticity. It is clarity: clean joinery, proportion, and a surface that improves with handling.\n\nTakumi Market helps us show the wood species, drying approach, and maintenance notes that let customers buy with confidence across borders. Utility can still be deeply specific.',
    pullQuote: 'Wood should age toward clarity, not gloss.',
    founded: 1980,
    milestones: [
      { year: 1980, event: 'Workshop founded in Takayama by a furniture joiner.' },
      { year: 2008, event: 'Expanded into tea trays and serving boards.' },
      { year: 2016, event: 'Launched a low-waste offcut object program.' },
      { year: 2024, event: 'Joined Takumi Market.' }
    ],
    materials: ['Hinoki cypress', 'Japanese chestnut', 'White oak'],
    techniques: ['Joinery', 'Hand planing', 'Oil finishing', 'Steam bending'],
    heroImage: {
      url: img('hida-hero', 1600, 900),
      alt: 'Airy wood studio with pale benches, trays, and boards leaning in window light.'
    },
    processImages: [
      {
        url: img('hida-process-1', 960, 640),
        alt: 'Wood shavings and a hand plane on a clean bench.',
        caption: 'Surface quality is judged by touch first, then by reflection.'
      },
      {
        url: img('hida-process-2', 960, 640),
        alt: 'Serving boards stacked by a bright wall.',
        caption: 'Boards are matched for grain flow before final finishing.'
      },
      {
        url: img('hida-process-3', 960, 640),
        alt: 'Steam-bent tray form clamped on a worktable.',
        caption: 'Steam bending keeps the curve gentle and resilient.'
      },
      {
        url: img('hida-process-4', 960, 640),
        alt: 'Small stool with visible joinery in a bright room.',
        caption: 'Joinery remains visible because honesty is part of the form.'
      }
    ],
    makerNotes:
      'Wood asks you to slow down at least once: when you wash it, oil it, or notice how it has changed.',
    verified: true,
    verifiedDate: '2024-11',
    quote: 'Use leaves the best finish.',
    heritage:
      'Takayama’s furniture and woodworking culture shapes the studio’s quiet joinery language and respect for visible grain.'
  },
  {
    id: 'tsubame-metalworks',
    name: 'Tsubame Metalworks',
    location: 'Tsubame, Niigata Prefecture',
    craft: 'Metalware',
    tagline: 'Light-catching metal objects with restrained industrial precision.',
    accentColor: '#8E9DAB',
    story:
      'We work in a city known for metal finishing, but our goal is not shine for its own sake. We like surfaces that catch morning light softly, edges that feel deliberate, and forms that stay practical even when they verge on sculptural.\n\nTakumi Market is useful because it lets us explain finish, care, and batch size without flattening the work into commodity hardware. Trust grows when details are explicit.',
    pullQuote: 'Metal should reflect light, not ego.',
    founded: 1978,
    milestones: [
      { year: 1978, event: 'Workshop founded in Tsubame’s metalworking district.' },
      { year: 2005, event: 'Introduced hammered finish collections for tea and coffee tools.' },
      { year: 2017, event: 'Expanded into scent and tabletop objects.' },
      { year: 2024, event: 'Joined Takumi Market.' }
    ],
    materials: ['Brass', 'Stainless steel', 'Copper'],
    techniques: ['Hammer finishing', 'Press forming', 'Polishing', 'Protective waxing'],
    heroImage: {
      url: img('tsubame-hero', 1600, 900),
      alt: 'Bright metal workshop with polished tools and reflective surfaces near a large window.'
    },
    processImages: [
      {
        url: img('tsubame-process-1', 960, 640),
        alt: 'Hammered metal surface close-up in bright light.',
        caption: 'Hammer marks are kept shallow so they catch light without visual noise.'
      },
      {
        url: img('tsubame-process-2', 960, 640),
        alt: 'Metalware components laid out on a white work surface.',
        caption: 'Parts are laid out in sequence to keep assembly consistent.'
      },
      {
        url: img('tsubame-process-3', 960, 640),
        alt: 'Tea kettle form being polished by hand.',
        caption: 'Final finishing aims for clarity, not mirror gloss.'
      },
      {
        url: img('tsubame-process-4', 960, 640),
        alt: 'Incense tray and small metal objects on pale stone.',
        caption: 'Small objects still deserve the same finish discipline as larger pieces.'
      }
    ],
    makerNotes:
      'I like metal best when it softens a room instead of dominating it. A little reflection is enough.',
    verified: true,
    verifiedDate: '2024-09',
    quote: 'Precision should still leave room for atmosphere.',
    heritage:
      'Tsubame’s metalworking heritage informs the studio’s careful finishing, repeatability, and material honesty.'
  }
]
