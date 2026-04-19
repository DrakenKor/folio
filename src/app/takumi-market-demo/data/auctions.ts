import { createPricing } from './regions'
import { Auction } from '../types'

function minutesAgo(minutes: number) {
  return Date.now() - minutes * 60 * 1000
}

export const auctions: Auction[] = [
  {
    id: 'limited-raku-bowl-drop',
    productId: 'limited-raku-bowl',
    title: 'Limited Raku Bowl Drop',
    auctionUnits: 3,
    totalUnits: 8,
    startingBid: createPricing(14000),
    currentBid: createPricing(21400),
    bidHistory: [
      {
        bidderId: 'Bidder #47',
        amountJPY: 21400,
        amount: createPricing(21400),
        createdAt: minutesAgo(2)
      },
      {
        bidderId: 'Bidder #31',
        amountJPY: 20100,
        amount: createPricing(20100),
        createdAt: minutesAgo(4)
      },
      {
        bidderId: 'Bidder #18',
        amountJPY: 18800,
        amount: createPricing(18800),
        createdAt: minutesAgo(8)
      },
      {
        bidderId: 'Bidder #12',
        amountJPY: 17600,
        amount: createPricing(17600),
        createdAt: minutesAgo(11)
      }
    ],
    endsAt: new Date(Date.now() + 32 * 60 * 1000).toISOString(),
    status: 'live',
    fairnessRules: [
      'Only part of the production run enters auction. Remaining stock stays fixed-price.',
      'Auction releases are reserved for exceptionally limited pieces with volatile demand.',
      'Makers participate in upside on rare demand spikes without turning their whole catalog into bidding.',
      'Bid activity is moderated for fairness. The demo does not simulate shill bidding or hidden reserve fees.'
    ]
  },
  {
    id: 'brass-kettle-reserve-release',
    productId: 'hammered-brass-tea-kettle',
    title: 'Brass Kettle Reserve Release',
    auctionUnits: 2,
    totalUnits: 6,
    startingBid: createPricing(28000),
    currentBid: createPricing(28000),
    bidHistory: [
      {
        bidderId: 'Bidder #09',
        amountJPY: 28000,
        amount: createPricing(28000),
        createdAt: minutesAgo(15)
      }
    ],
    endsAt: new Date(Date.now() + 96 * 60 * 1000).toISOString(),
    status: 'upcoming',
    fairnessRules: [
      'A small reserve allocation enters auction once the release opens.',
      'Most units remain available at fixed price to prevent all-demand events from blocking access.',
      'Bidders see the current minimum clearly before confirming a bid.',
      'Auction closes cleanly at the timer end with a visible winning bidder ID.'
    ]
  }
]

