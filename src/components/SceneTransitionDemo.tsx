'use client'

import React, { useState } from 'react'
import { useSceneTransition } from '@/hooks/useSceneTransition'
import { SceneType } from '@/lib/scene-management/types'
import { SectionType } from '@/types'
import { SceneTransitionLoader, SceneTransitionProgressBar } from './SceneTransitionLoader'

/**
 * Demo component to test scene transitions
 */
export function SceneTransitionDemo() {
  const [selectedEasing, setSelectedEasing] = useState('easeInOutCubic')
  const [duration, setDuration] = useState(1000)
  const [showLoader, setShowLoader] = useState(true)
  const [loaderVariant, setLoaderVariant] = useState<'minimal' | 'detailed' | 'fullscreen'>('detailed')

  const { transitionTo, transitionState, loadingState, isTransitioning } = useSceneTransition({
    onStart: (from, to) => {
      console.log(`Transition started: ${from} -> ${to}`)
    },
    onProgress: (progress, stage) => {
      console.log(`Transition progress: ${Math.round(progress * 100)}% (${stage})`)
    },
    onComplete: (scene) => {
      console.log(`Transition completed to: ${scene}`)
    },
    onError: (error) => {
      console.error('Transition error:', error)
    }
  })

  const scenes: { id: SceneType; name: string; description: string }[] = [
    { id: SectionType.HOME as SceneType, name: 'Home', description: 'Landing page with particles' },
    { id: SectionType.RESUME as SceneType, name: 'Resume', description: '3D timeline of experience' },
    { id: SectionType.MATH_GALLERY as SceneType, name: 'Math Gallery', description: 'Mathematical visualizations' },
    { id: SectionType.CODE_VISUALIZER as SceneType, name: 'Code Visualizer', description: 'Architecture diagrams' },
    { id: SectionType.WASM_DEMOS as SceneType, name: 'WASM Demos', description: 'Performance demonstrations' },
    { id: SectionType.SHADER_PLAYGROUND as SceneType, name: 'Shader Playground', description: 'GPU-accelerated art' }
  ]

  const easingOptions = [
    'linear', 'easeInQuad', 'easeOutQuad', 'easeInOutQuad',
    'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
    'easeInQuart', 'easeOutQuart', 'easeInOutQuart',
    'easeInSine', 'easeOutSine', 'easeInOutSine',
    'easeInExpo', 'easeOutExpo', 'easeInOutExpo',
    'easeInCirc', 'easeOutCirc', 'easeInOutCirc',
    'easeInBack', 'easeOutBack', 'easeInOutBack',
    'easeInElastic', 'easeOutElastic', 'easeInOutElastic',
    'easeInBounce', 'easeOutBounce', 'easeInOutBounce'
  ]

  const handleTransition = async (sceneType: SceneType) => {
    if (isTransitioning) return

    try {
      await transitionTo(sceneType, {
        duration,
        easing: selectedEasing
      })
    } catch (error) {
      console.error('Failed to transition:', error)
    }
  }

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Scene Transition System Demo</h1>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Transition Controls</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Duration (ms)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                min="100"
                max="5000"
                step="100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Easing Function</label>
              <select
                value={selectedEasing}
                onChange={(e) => setSelectedEasing(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                {easingOptions.map(easing => (
                  <option key={easing} value={easing}>{easing}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Loader Variant</label>
              <select
                value={loaderVariant}
                onChange={(e) => setLoaderVariant(e.target.value as any)}
                className="w-full px-3 py-2 bg-gray-700 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="minimal">Minimal</option>
                <option value="detailed">Detailed</option>
                <option value="fullscreen">Fullscreen</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showLoader}
                onChange={(e) => setShowLoader(e.target.checked)}
                className="mr-2"
              />
              Show Loader
            </label>
          </div>
        </div>

        {/* Scene Buttons */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Available Scenes</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenes.map(scene => (
              <button
                key={scene.id}
                onClick={() => handleTransition(scene.id)}
                disabled={isTransitioning}
                className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                  transitionState.toScene === scene.id
                    ? 'border-blue-500 bg-blue-500/20'
                    : transitionState.fromScene === scene.id
                    ? 'border-yellow-500 bg-yellow-500/20'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                } ${isTransitioning ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'}`}
              >
                <h3 className="font-semibold mb-1">{scene.name}</h3>
                <p className="text-sm text-gray-300">{scene.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Status Display */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Transition Status</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Transition State</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Is Transitioning:</span>
                  <span className={isTransitioning ? 'text-yellow-400' : 'text-green-400'}>
                    {isTransitioning ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span className="font-mono">{Math.round(transitionState.progress * 100)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>From Scene:</span>
                  <span className="text-blue-400">{transitionState.fromScene || 'None'}</span>
                </div>
                <div className="flex justify-between">
                  <span>To Scene:</span>
                  <span className="text-green-400">{transitionState.toScene || 'None'}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-2">Loading State</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Is Loading:</span>
                  <span className={loadingState.isLoading ? 'text-yellow-400' : 'text-green-400'}>
                    {loadingState.isLoading ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Stage:</span>
                  <span className="text-purple-400">{loadingState.stage}</span>
                </div>
                <div className="flex justify-between">
                  <span>Progress:</span>
                  <span className="font-mono">{Math.round(loadingState.progress * 100)}%</span>
                </div>
                <div className="col-span-2">
                  <span>Message:</span>
                  <div className="text-gray-300 mt-1">{loadingState.message}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Components */}
      {showLoader && (
        <>
          <SceneTransitionLoader variant={loaderVariant} />
          <SceneTransitionProgressBar />
        </>
      )}
    </div>
  )
}
