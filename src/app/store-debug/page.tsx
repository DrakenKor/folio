'use client'

import React from 'react'
import {
  useAppStore,
  useCurrentSection,
  useNavigationState
} from '@/stores/app-store'
import { SectionType } from '@/types'

export default function StoreDebug() {
  const currentSection = useCurrentSection()
  const navigationState = useNavigationState()
  const { setCurrentSection } = useAppStore()
  const store = useAppStore()

  const handleSectionChange = (section: SectionType) => {
    console.log('Changing section to:', section)
    setCurrentSection(section)
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-2xl font-bold mb-6">Store Debug</h1>

      <div className="grid gap-6">
        {/* Current State */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Current State</h2>
          <p>
            Current Section:{' '}
            <span className="text-yellow-400">{currentSection}</span>
          </p>
          <p>
            Previous Section:{' '}
            <span className="text-yellow-400">
              {navigationState.previousSection || 'null'}
            </span>
          </p>
          <p>
            Is Transitioning:{' '}
            <span className="text-yellow-400">
              {navigationState.isTransitioning ? 'true' : 'false'}
            </span>
          </p>
          <p>
            Transition Progress:{' '}
            <span className="text-yellow-400">
              {navigationState.transitionProgress}
            </span>
          </p>
        </div>

        {/* Full Store State */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Full Navigation State</h2>
          <pre className="text-xs text-gray-300 overflow-auto">
            {JSON.stringify(navigationState, null, 2)}
          </pre>
        </div>

        {/* Test Buttons */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Test Navigation</h2>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(SectionType).map((section) => (
              <button
                key={section}
                onClick={() => handleSectionChange(section)}
                className={`p-2 rounded text-sm ${
                  currentSection === section
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-600 text-gray-200 hover:bg-gray-500'
                }`}>
                {section}
              </button>
            ))}
          </div>
        </div>

        {/* Store Methods Test */}
        <div className="bg-gray-800 p-4 rounded">
          <h2 className="text-lg font-semibold mb-2">Store Methods</h2>
          <button
            onClick={() => {
              console.log('Testing store methods...')
              console.log(
                'setCurrentSection exists:',
                typeof store.setCurrentSection
              )
              console.log('Current store state:', store)
            }}
            className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded">
            Log Store Info
          </button>
        </div>
      </div>
    </div>
  )
}
