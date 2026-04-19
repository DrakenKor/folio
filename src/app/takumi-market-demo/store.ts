'use client'

import { create } from 'zustand'
import { auctions } from './data/auctions'
import { clampQuantity, randomBidderId, toRegionalPricing } from './utils'
import { AuctionBidEntry, CartItem, Region, ToastItem } from './types'

let toastCounter = 0

interface TakumiStore {
  region: Region
  setRegion: (region: Region) => void
  cart: CartItem[]
  addToCart: (productId: string, quantity?: number) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  cartOpen: boolean
  setCartOpen: (open: boolean) => void
  checkoutOpen: boolean
  setCheckoutOpen: (open: boolean) => void
  searchOpen: boolean
  searchQuery: string
  setSearchOpen: (open: boolean) => void
  setSearchQuery: (query: string) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  auctionBids: Record<string, AuctionBidEntry[]>
  userBids: Record<string, number[]>
  placeBid: (auctionId: string, amountJPY: number) => void
  simulateBid: (auctionId: string, amountJPY: number) => void
  toasts: ToastItem[]
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  dismissToast: (id: string) => void
  cartPulseToken: number
}

const initialAuctionBids = auctions.reduce<Record<string, AuctionBidEntry[]>>((accumulator, auction) => {
  accumulator[auction.id] = auction.bidHistory
  return accumulator
}, {})

export const useTakumiStore = create<TakumiStore>((set, get) => ({
  region: 'USD',
  setRegion: (region) => set({ region }),
  cart: [],
  addToCart: (productId, quantity = 1) =>
    set((state) => {
      const nextCart = [...state.cart]
      const existing = nextCart.find((item) => item.productId === productId)
      if (existing) {
        existing.quantity = clampQuantity(existing.quantity + quantity)
      } else {
        nextCart.push({ productId, quantity: clampQuantity(quantity) })
      }
      return {
        cart: nextCart,
        cartPulseToken: state.cartPulseToken + 1
      }
    }),
  removeFromCart: (productId) =>
    set((state) => ({
      cart: state.cart.filter((item) => item.productId !== productId)
    })),
  updateQuantity: (productId, quantity) =>
    set((state) => ({
      cart: state.cart.map((item) =>
        item.productId === productId ? { ...item, quantity: clampQuantity(quantity) } : item
      )
    })),
  clearCart: () => set({ cart: [] }),
  cartOpen: false,
  setCartOpen: (open) => set({ cartOpen: open }),
  checkoutOpen: false,
  setCheckoutOpen: (open) => set({ checkoutOpen: open }),
  searchOpen: false,
  searchQuery: '',
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  auctionBids: initialAuctionBids,
  userBids: {},
  placeBid: (auctionId, amountJPY) =>
    set((state) => {
      const nextBid: AuctionBidEntry = {
        bidderId: 'You',
        amountJPY,
        amount: toRegionalPricing(amountJPY),
        createdAt: Date.now(),
        isUser: true
      }
      const updated = [nextBid, ...(state.auctionBids[auctionId] ?? [])].slice(0, 10)
      return {
        auctionBids: {
          ...state.auctionBids,
          [auctionId]: updated
        },
        userBids: {
          ...state.userBids,
          [auctionId]: [...(state.userBids[auctionId] ?? []), amountJPY]
        }
      }
    }),
  simulateBid: (auctionId, amountJPY) =>
    set((state) => {
      const nextBid: AuctionBidEntry = {
        bidderId: randomBidderId(),
        amountJPY,
        amount: toRegionalPricing(amountJPY),
        createdAt: Date.now()
      }
      return {
        auctionBids: {
          ...state.auctionBids,
          [auctionId]: [nextBid, ...(state.auctionBids[auctionId] ?? [])].slice(0, 10)
        }
      }
    }),
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${Date.now()}-${toastCounter++}`
    const nextToast: ToastItem = { id, ...toast }
    set((state) => {
      const nextToasts = [...state.toasts, nextToast]
      return {
        toasts: nextToasts.slice(Math.max(0, nextToasts.length - 3))
      }
    })

    window.setTimeout(() => {
      get().dismissToast(id)
    }, 4000)
  },
  dismissToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id)
    })),
  cartPulseToken: 0
}))

