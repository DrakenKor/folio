'use client'

import { startTransition, useEffect, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { auctions } from './data/auctions'
import { collections } from './data/collections'
import { makers } from './data/makers'
import { products } from './data/products'
import { CheckoutModal } from './components/CheckoutModal'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { SearchOverlay } from './components/SearchOverlay'
import { ToastViewport } from './components/ToastViewport'
import { CartDrawer } from './components/CartDrawer'
import { AboutView } from './components/views/AboutView'
import { AuctionView } from './components/views/AuctionView'
import { HomeView } from './components/views/HomeView'
import { MakerView } from './components/views/MakerView'
import { MarketplaceView } from './components/views/MarketplaceView'
import { ProductView } from './components/views/ProductView'
import { useTakumiStore } from './store'
import { Product, Region, ToastItem, ViewParams } from './types'
import {
  buildDemoQuery,
  countdownParts,
  getAuctionById,
  getMakerById,
  getProductById,
  sanitizeCategory,
  sanitizeRegion,
  sanitizeSort,
  sanitizeView
} from './utils'
import styles from './takumi-market.module.css'

export function TakumiMarketDemo({ className }: { className?: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const regionFromUrl = sanitizeRegion(searchParams.get('region'))
  const view = sanitizeView(searchParams.get('view'))
  const selectedId = searchParams.get('id')
  const category = sanitizeCategory(searchParams.get('category'))
  const sort = sanitizeSort(searchParams.get('sort'))
  const selectedCollectionId = searchParams.get('collection') ?? undefined

  const region = useTakumiStore((state) => state.region)
  const setRegion = useTakumiStore((state) => state.setRegion)
  const cart = useTakumiStore((state) => state.cart)
  const addToCart = useTakumiStore((state) => state.addToCart)
  const removeFromCart = useTakumiStore((state) => state.removeFromCart)
  const updateQuantity = useTakumiStore((state) => state.updateQuantity)
  const clearCart = useTakumiStore((state) => state.clearCart)
  const cartOpen = useTakumiStore((state) => state.cartOpen)
  const setCartOpen = useTakumiStore((state) => state.setCartOpen)
  const checkoutOpen = useTakumiStore((state) => state.checkoutOpen)
  const setCheckoutOpen = useTakumiStore((state) => state.setCheckoutOpen)
  const searchOpen = useTakumiStore((state) => state.searchOpen)
  const searchQuery = useTakumiStore((state) => state.searchQuery)
  const setSearchOpen = useTakumiStore((state) => state.setSearchOpen)
  const setSearchQuery = useTakumiStore((state) => state.setSearchQuery)
  const mobileNavOpen = useTakumiStore((state) => state.mobileNavOpen)
  const setMobileNavOpen = useTakumiStore((state) => state.setMobileNavOpen)
  const auctionBids = useTakumiStore((state) => state.auctionBids)
  const placeBid = useTakumiStore((state) => state.placeBid)
  const simulateBid = useTakumiStore((state) => state.simulateBid)
  const toasts = useTakumiStore((state) => state.toasts)
  const addToast = useTakumiStore((state) => state.addToast)
  const dismissToast = useTakumiStore((state) => state.dismissToast)
  const cartPulseToken = useTakumiStore((state) => state.cartPulseToken)

  const endedAuctionToastRef = useRef<Record<string, boolean>>({})

  useEffect(() => {
    if (region !== regionFromUrl) {
      setRegion(regionFromUrl)
    }
  }, [region, regionFromUrl, setRegion])

  useEffect(() => {
    if (searchParams.get('region')) {
      return
    }

    startTransition(() => {
      router.replace(`/takumi-market-demo${buildDemoQuery({ view, id: selectedId ?? undefined, category, sort, collection: selectedCollectionId, region: regionFromUrl })}`, {
        scroll: false
      })
    })
  }, [category, regionFromUrl, router, searchParams, selectedCollectionId, selectedId, sort, view])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [view, selectedId, category, selectedCollectionId, sort])

  useEffect(() => {
    setMobileNavOpen(false)
  }, [view, selectedId, setMobileNavOpen])

  useEffect(() => {
    auctions.forEach((auction) => {
      const ended = countdownParts(auction.endsAt).totalSeconds <= 0
      if (ended && !endedAuctionToastRef.current[auction.id]) {
        endedAuctionToastRef.current[auction.id] = true
        addToast({
          message: `${auction.title} has ended.`,
          type: 'neutral'
        })
      }
    })
  }, [addToast, auctionBids])

  const currentRegion: Region = regionFromUrl
  const selectedMaker = getMakerById(makers, selectedId) ?? makers[0]
  const selectedProduct = getProductById(products, selectedId) ?? products[0]
  const selectedAuction = getAuctionById(auctions, selectedId) ?? auctions[0]
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const bidsForAuction = auctionBids[selectedAuction.id] ?? selectedAuction.bidHistory

  const navigate = (params: ViewParams, replace = false) => {
    const query = buildDemoQuery({
      view: params.view,
      id: params.id,
      category: params.category,
      sort: params.sort,
      collection: params.collection,
      region: params.region ?? currentRegion
    })

    startTransition(() => {
      if (replace) {
        router.replace(`/takumi-market-demo${query}`, { scroll: false })
      } else {
        router.push(`/takumi-market-demo${query}`, { scroll: false })
      }
    })
  }

  const handleChangeRegion = (nextRegion: Region) => {
    if (nextRegion === currentRegion) {
      return
    }

    setRegion(nextRegion)
    addToast({
      message: `Region changed to ${nextRegion}.`,
      type: 'info'
    })
    navigate(
      {
        view,
        id: selectedId ?? undefined,
        category,
        sort,
        collection: selectedCollectionId,
        region: nextRegion
      },
      true
    )
  }

  const handleAddToCart = (product: Product, quantity: number) => {
    addToCart(product.id, quantity)
    addToast({
      message: `${product.name} added to cart`,
      type: 'success',
      link: { label: 'View Cart', target: 'cart' }
    })
  }

  const handlePlaceBid = (auctionId: string, productName: string, amountJPY: number) => {
    placeBid(auctionId, amountJPY)
    addToast({
      message: `Bid placed on ${productName}`,
      type: 'info'
    })
  }

  const handleFollowToastLink = (toast: ToastItem) => {
    dismissToast(toast.id)
    if (!toast.link) {
      return
    }

    if (toast.link.target === 'cart') {
      setCartOpen(true)
      return
    }

    navigate({
      view: toast.link.view ?? 'home',
      id: toast.link.id,
      category: toast.link.category,
      collection: toast.link.collection,
      region: currentRegion
    })
  }

  const relatedProducts = useMemo(() => {
    return products.filter(
      (product) =>
        product.id !== selectedProduct.id &&
        (product.makerId === selectedProduct.makerId || product.category === selectedProduct.category)
    )
  }, [selectedProduct.id, selectedProduct.category, selectedProduct.makerId])

  const relatedAuctionProducts = useMemo(() => {
    return products.filter(
      (product) =>
        product.id !== selectedAuction.productId &&
        product.stockStatus !== 'sold-out' &&
        (product.makerId === selectedProduct.makerId || product.category === selectedProduct.category)
    )
  }, [selectedAuction.productId, selectedProduct.category, selectedProduct.makerId])

  const makersById = useMemo(
    () =>
      makers.reduce<Record<string, typeof makers[number]>>((accumulator, maker) => {
        accumulator[maker.id] = maker
        return accumulator
      }, {}),
    []
  )

  let content = null
  if (view === 'marketplace') {
    content = (
      <MarketplaceView
        region={currentRegion}
        makers={makers}
        products={products}
        auctions={auctions}
        collections={collections}
        selectedCategory={category}
        selectedCollectionId={selectedCollectionId}
        sort={sort}
        onNavigate={navigate}
      />
    )
  } else if (view === 'maker') {
    content = (
      <MakerView
        maker={selectedMaker}
        products={products}
        auctions={auctions}
        region={currentRegion}
        onNavigate={navigate}
      />
    )
  } else if (view === 'product') {
    content = (
      <ProductView
        product={selectedProduct}
        maker={makersById[selectedProduct.makerId]}
        relatedProducts={relatedProducts}
        auctions={auctions}
        region={currentRegion}
        onNavigate={navigate}
        onAddToCart={handleAddToCart}
      />
    )
  } else if (view === 'auction') {
    const auctionProduct = getProductById(products, selectedAuction.productId) ?? products[0]
    const auctionMaker = makersById[auctionProduct.makerId]
    content = (
      <AuctionView
        auction={selectedAuction}
        product={auctionProduct}
        maker={auctionMaker}
        bids={auctionBids[selectedAuction.id] ?? selectedAuction.bidHistory}
        relatedProducts={relatedAuctionProducts}
        region={currentRegion}
        onNavigate={navigate}
        onPlaceBid={(auctionEntry, amountJPY) => handlePlaceBid(auctionEntry.id, auctionProduct.name, amountJPY)}
        onSimulateBid={simulateBid}
      />
    )
  } else if (view === 'about') {
    content = <AboutView region={currentRegion} onNavigate={navigate} />
  } else {
    content = (
      <HomeView
        region={currentRegion}
        makers={makers}
        products={products}
        auctions={auctions}
        onNavigate={navigate}
      />
    )
  }

  return (
    <div className={`${styles.page} ${className ?? ''}`}>
      <Header
        currentView={view}
        region={currentRegion}
        cartCount={cartCount}
        cartPulseToken={cartPulseToken}
        mobileNavOpen={mobileNavOpen}
        onMobileNavChange={setMobileNavOpen}
        onNavigate={navigate}
        onChangeRegion={handleChangeRegion}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenCart={() => setCartOpen(true)}
      />

      <main key={`${view}-${selectedId ?? 'root'}-${category ?? 'all'}-${selectedCollectionId ?? 'all'}-${sort}`} className={styles.viewFrame}>
        {content}
      </main>

      <Footer region={currentRegion} onNavigate={navigate} />

      <SearchOverlay
        open={searchOpen}
        query={searchQuery}
        products={products}
        makers={makers}
        region={currentRegion}
        onClose={() => {
          setSearchOpen(false)
          setSearchQuery('')
        }}
        onQueryChange={setSearchQuery}
        onOpenProduct={(id) => navigate({ view: 'product', id, region: currentRegion })}
        onOpenMaker={(id) => navigate({ view: 'maker', id, region: currentRegion })}
      />

      <CartDrawer
        open={cartOpen}
        cart={cart}
        products={products}
        makers={makers}
        region={currentRegion}
        onClose={() => setCartOpen(false)}
        onCheckout={() => setCheckoutOpen(true)}
        onNavigateMarketplace={() => navigate({ view: 'marketplace', region: currentRegion })}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
      />

      <CheckoutModal
        open={checkoutOpen}
        cart={cart}
        products={products}
        region={currentRegion}
        onClose={() => setCheckoutOpen(false)}
        onOrderPlaced={() => {
          clearCart()
          addToast({
            message: 'Order placed successfully.',
            type: 'success'
          })
        }}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} onFollowLink={handleFollowToastLink} />
    </div>
  )
}
