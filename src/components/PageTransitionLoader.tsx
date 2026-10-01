'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import RubiLoader from '@/app/components/Loaders/RubiLoader'
import { isDemoRoute } from '@/lib/demos'

export function PageTransitionLoader() {
  const pathname = usePathname()
  const [isLoading, setIsLoading] = useState(false)
  const previousPathRef = useRef<string>(pathname)
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      previousPathRef.current = pathname
      return
    }

    // If path changed, show loader
    if (pathname !== previousPathRef.current) {
      // Both ends of a demo navigation are black: change nothing but the content
      const involvesDemo = isDemoRoute(pathname) || isDemoRoute(previousPathRef.current)
      previousPathRef.current = pathname
      if (involvesDemo) {
        setIsLoading(false)
        return
      }
      setIsLoading(true)

      // Hide loader after a short delay to show the transition
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)

      return () => clearTimeout(timer)
    }
  }, [pathname])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center space-y-4">
        <RubiLoader type="white" height={48} width={48} />
        <p className="text-white text-sm font-medium animate-pulse">
          Loading...
        </p>
      </div>
    </div>
  )
}
