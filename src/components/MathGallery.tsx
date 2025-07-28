'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  MathVisualization,
  GallerySection,
  VisualizationState
} from '@/types/math-visualization'
import { VisualizationCanvas } from './VisualizationCanvas'
import { VisualizationControls } from './VisualizationControls'
import { GalleryNavigation } from './GalleryNavigation'

interface MathGalleryProps {
  sections: GallerySection[]
  className?: string
}

export const MathGallery: React.FC<MathGalleryProps> = ({
  sections,
  className = ''
}) => {
  const [activeSection, setActiveSection] = useState<string>(
    sections[0]?.id || ''
  )
  const [activeVisualization, setActiveVisualization] = useState<string>('')
  const [visualizationStates, setVisualizationStates] = useState<
    Record<string, VisualizationState>
  >({})

  const currentSection = sections.find((s) => s.id === activeSection)
  const currentVisualization = currentSection?.visualizations.find(
    (v) => v.id === activeVisualization
  )

  // Initialize visualization states
  useEffect(() => {
    const states: Record<string, VisualizationState> = {}
    sections.forEach((section) => {
      section.visualizations.forEach((viz) => {
        states[viz.id] = {
          isActive: false,
          isLoading: false,
          parameters: {}
        }
      })
    })
    setVisualizationStates(states)
  }, [sections])

  // Set initial active visualization when section changes
  useEffect(() => {
    if (currentSection && currentSection.visualizations.length > 0) {
      setActiveVisualization(currentSection.visualizations[0].id)
    }
  }, [activeSection, currentSection])

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId)
  }

  const handleVisualizationChange = (vizId: string) => {
    setActiveVisualization(vizId)
  }

  const updateVisualizationState = (
    vizId: string,
    updates: Partial<VisualizationState>
  ) => {
    setVisualizationStates((prev) => ({
      ...prev,
      [vizId]: { ...prev[vizId], ...updates }
    }))
  }

  return (
    <div className={`math-gallery ${className}`}>
      <div className="gallery-header">
        <h1 className="text-3xl font-bold text-white mb-4">
          Mathematical Art Gallery
        </h1>
        <p className="text-gray-300 mb-6">
          Explore interactive mathematical visualizations and algorithms
        </p>
      </div>

      <div className="gallery-content grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="lg:col-span-1">
          <GalleryNavigation
            sections={sections}
            activeSection={activeSection}
            activeVisualization={activeVisualization}
            onSectionChange={handleSectionChange}
            onVisualizationChange={handleVisualizationChange}
          />
        </div>

        {/* Main Visualization Area */}
        <div className="lg:col-span-2">
          {currentVisualization ? (
            <VisualizationCanvas
              visualization={currentVisualization}
              state={visualizationStates[currentVisualization.id]}
              onStateUpdate={(updates) =>
                updateVisualizationState(currentVisualization.id, updates)
              }
            />
          ) : (
            <div className="visualization-placeholder bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">Select a visualization to begin</p>
            </div>
          )}
        </div>

        {/* Controls Panel */}
        <div className="lg:col-span-1">
          {currentVisualization && (
            <VisualizationControls
              key={`${currentVisualization.id}-${JSON.stringify(
                visualizationStates[currentVisualization.id]?.parameters || {}
              )}`}
              visualization={currentVisualization}
              state={visualizationStates[currentVisualization.id]}
              onParameterChange={(key, value) => {
                currentVisualization.setParameter(key, value)
                updateVisualizationState(currentVisualization.id, {
                  parameters: {
                    ...visualizationStates[currentVisualization.id].parameters,
                    [key]: value
                  }
                })
              }}
              onReset={() => {
                currentVisualization.reset()
                updateVisualizationState(currentVisualization.id, {
                  parameters: {}
                })
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
