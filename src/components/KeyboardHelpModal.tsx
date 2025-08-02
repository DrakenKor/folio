'use client'

import React, { useEffect, useState } from 'react'

interface KeyboardShortcut {
  keys: string[]
  description: string
  category: string
}

const keyboardShortcuts: KeyboardShortcut[] = [
  {
    keys: ['↑', '↓', '←', '→'],
    description: 'Navigate between sections',
    category: 'Navigation'
  },
  {
    keys: ['J', 'K'],
    description: 'Navigate next/previous (Vim-style)',
    category: 'Navigation'
  },
  {
    keys: ['Home', 'H'],
    description: 'Go to home section',
    category: 'Navigation'
  },
  {
    keys: ['End'],
    description: 'Go to last section',
    category: 'Navigation'
  },
  {
    keys: ['1', '2', '3', '4', '5', '6'],
    description: 'Jump to specific section',
    category: 'Navigation'
  },
  {
    keys: ['Enter', 'Space'],
    description: 'Select current section',
    category: 'Actions'
  },
  {
    keys: ['Escape'],
    description: 'Toggle navigation menu (mobile)',
    category: 'Actions'
  },
  {
    keys: ['P'],
    description: 'Preload next section',
    category: 'Performance'
  },
  {
    keys: ['?'],
    description: 'Show/hide this help',
    category: 'Help'
  }
]

interface KeyboardHelpModalProps {
  isOpen: boolean
  onClose: () => void
}

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({
  isOpen,
  onClose
}) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === '?') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isVisible) return null

  const categories = Array.from(new Set(keyboardShortcuts.map(s => s.category)))

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={onClose}>
      <div
        className={`bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto transition-all duration-300 ${
          isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800"
            aria-label="Close help modal">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="text-lg font-semibold text-blue-400 mb-3 border-b border-gray-700 pb-1">
                {category}
              </h3>
              <div className="space-y-2">
                {keyboardShortcuts
                  .filter(shortcut => shortcut.category === category)
                  .map((shortcut, index) => (
                    <div key={index} className="flex items-center justify-between py-2">
                      <span className="text-gray-300">{shortcut.description}</span>
                      <div className="flex gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="px-2 py-1 text-xs font-mono bg-gray-800 border border-gray-600 rounded text-gray-200">
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-400 text-center">
            Press <kbd className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded">?</kbd> or{' '}
            <kbd className="px-1 py-0.5 text-xs bg-gray-800 border border-gray-600 rounded">Escape</kbd> to close this help
          </p>
        </div>
      </div>
    </div>
  )
}

export default KeyboardHelpModal
