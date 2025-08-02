'use client'

import React from 'react'
import { GallerySection } from '@/types/math-visualization'
import { mathGalleryIcons, MathGalleryIconType } from './icons/MathGalleryIcons'

interface GalleryNavigationProps {
  sections: GallerySection[]
  activeSection: string
  activeVisualization: string
  onSectionChange: (sectionId: string) => void
  onVisualizationChange: (vizId: string) => void
}

export const GalleryNavigation: React.FC<GalleryNavigationProps> = ({
  sections,
  activeSection,
  activeVisualization,
  onSectionChange,
  onVisualizationChange
}) => {
  return (
    <nav className="gallery-navigation bg-gray-900 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Sections</h2>

      <div className="space-y-2">
        {sections.map(section => (
          <div key={section.id} className="section-group">
            <button
              onClick={() => onSectionChange(section.id)}
              className={`section-button w-full text-left p-3 rounded-lg transition-colors ${
                activeSection === section.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {(() => {
                    const IconComponent = mathGalleryIcons[section.icon as MathGalleryIconType]
                    return IconComponent ? (
                      <IconComponent
                        size={20}
                        className={activeSection === section.id ? 'text-white' : 'text-gray-400'}
                      />
                    ) : (
                      <span className="text-xl">{section.icon}</span>
                    )
                  })()}
                </div>
                <div>
                  <div className="font-medium">{section.title}</div>
                  <div className="text-sm opacity-75">{section.description}</div>
                </div>
              </div>
            </button>

            {activeSection === section.id && (
              <div className="visualization-list mt-2 ml-4 space-y-1">
                {section.visualizations.map(viz => (
                  <button
                    key={viz.id}
                    onClick={() => onVisualizationChange(viz.id)}
                    className={`viz-button w-full text-left p-2 rounded text-sm transition-colors ${
                      activeVisualization === viz.id
                        ? 'bg-blue-500 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {viz.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
