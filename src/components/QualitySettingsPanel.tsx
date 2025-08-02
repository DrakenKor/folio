'use client'

import React, { useState } from 'react'
import { useAdaptiveQuality } from '@/hooks/useAdaptiveQuality'
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities'
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor'
import { QualityLevel } from '@/types'

interface QualitySettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export const QualitySettingsPanel: React.FC<QualitySettingsPanelProps> = ({
  isOpen,
  onClose
}) => {
  const {
    settings,
    setQualityLevel,
    setConfig,
    overrideSettings,
    resetToAutomatic,
    getCurrentLevel
  } = useAdaptiveQuality()

  const { capabilities } = useDeviceCapabilities()
  const { metrics } = usePerformanceMonitor()

  const [isAutomatic, setIsAutomatic] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  if (!isOpen) return null

  const handleQualityChange = (level: QualityLevel) => {
    setQualityLevel(level)
    setIsAutomatic(false)
  }

  const handleAutomaticToggle = () => {
    if (isAutomatic) {
      setIsAutomatic(false)
    } else {
      resetToAutomatic()
      setIsAutomatic(true)
    }
  }

  const getQualityColor = (level: QualityLevel) => {
    switch (level) {
      case QualityLevel.LOW: return 'text-red-600'
      case QualityLevel.MEDIUM: return 'text-yellow-600'
      case QualityLevel.HIGH: return 'text-green-600'
      case QualityLevel.ULTRA: return 'text-blue-600'
      default: return 'text-gray-600'
    }
  }

  const getPerformanceStatus = () => {
    if (!metrics) return { text: 'Unknown', color: 'text-white' }

    if (metrics.fps >= 55) return { text: 'Excellent', color: 'text-green-600' }
    if (metrics.fps >= 45) return { text: 'Good', color: 'text-green-500' }
    if (metrics.fps >= 30) return { text: 'Fair', color: 'text-yellow-600' }
    return { text: 'Poor', color: 'text-red-600' }
  }

  const performanceStatus = getPerformanceStatus()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Quality Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Current Status */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-3">Current Status</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Quality Level:</span>
                <span className={`font-medium ${getQualityColor(getCurrentLevel())}`}>
                  {getCurrentLevel().toUpperCase()}
                </span>
              </div>
              {metrics && (
                <>
                  <div className="flex justify-between">
                    <span>Performance:</span>
                    <span className={`font-medium ${performanceStatus.color}`}>
                      {performanceStatus.text}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>FPS:</span>
                    <span className="font-medium">{Math.round(metrics.fps)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Memory:</span>
                    <span className="font-medium">{metrics.memoryUsage}MB</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Automatic Quality Toggle */}
          <div className="mb-6">
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={isAutomatic}
                onChange={handleAutomaticToggle}
                className="rounded"
              />
              <span className="font-medium">Automatic Quality Adjustment</span>
            </label>
            <p className="text-sm text-gray-600 mt-1">
              Automatically adjusts quality based on performance
            </p>
          </div>

          {/* Manual Quality Selection */}
          {!isAutomatic && (
            <div className="mb-6">
              <h3 className="font-medium mb-3">Manual Quality Level</h3>
              <div className="space-y-2">
                {Object.values(QualityLevel).map((level) => (
                  <label key={level} className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="quality"
                      value={level}
                      checked={getCurrentLevel() === level}
                      onChange={() => handleQualityChange(level)}
                      className="text-blue-600"
                    />
                    <span className={`capitalize ${getQualityColor(level)}`}>
                      {level}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div className="mb-6">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700"
            >
              <span>Advanced Settings</span>
              <span className={`transform transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Particle Count: {settings.particleCount}
                  </label>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    value={settings.particleCount}
                    onChange={(e) => overrideSettings({ particleCount: parseInt(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">
                    Render Scale: {(settings.renderScale * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.0"
                    step="0.1"
                    value={settings.renderScale}
                    onChange={(e) => overrideSettings({ renderScale: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.postProcessing}
                      onChange={(e) => overrideSettings({ postProcessing: e.target.checked })}
                    />
                    <span className="text-sm">Post Processing</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.antialiasing}
                      onChange={(e) => overrideSettings({ antialiasing: e.target.checked })}
                    />
                    <span className="text-sm">Antialiasing</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.enableReflections}
                      onChange={(e) => overrideSettings({ enableReflections: e.target.checked })}
                    />
                    <span className="text-sm">Reflections</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={settings.enableSSAO}
                      onChange={(e) => overrideSettings({ enableSSAO: e.target.checked })}
                    />
                    <span className="text-sm">SSAO</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Device Information */}
          {capabilities && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium mb-3">Device Information</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>WebGL Version:</span>
                  <span>{capabilities.webglVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span>Memory:</span>
                  <span>{capabilities.memoryGB}GB</span>
                </div>
                <div className="flex justify-between">
                  <span>CPU Cores:</span>
                  <span>{capabilities.cores}</span>
                </div>
                <div className="flex justify-between">
                  <span>Performance Score:</span>
                  <span>{capabilities.performanceScore}/100</span>
                </div>
                <div className="flex justify-between">
                  <span>Device Type:</span>
                  <span>
                    {capabilities.isMobile ? 'Mobile' : capabilities.isTablet ? 'Tablet' : 'Desktop'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>WASM Support:</span>
                  <span>{capabilities.supportsWASM ? '✓' : '✗'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={resetToAutomatic}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reset to Auto
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Quality indicator component for showing current quality in the UI
export const QualityIndicator: React.FC<{ onClick?: () => void }> = ({ onClick }) => {
  const { getCurrentLevel } = useAdaptiveQuality(false)
  const { metrics } = usePerformanceMonitor()

  const level = getCurrentLevel()
  const fps = metrics?.fps || 0

  const getIndicatorColor = () => {
    if (fps >= 55) return 'bg-green-500'
    if (fps >= 45) return 'bg-green-400'
    if (fps >= 30) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 hover:shadow-xl transition-shadow"
      title="Quality Settings"
    >
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${getIndicatorColor()}`} />
        <div className="text-sm">
          <div className="font-medium capitalize">{level}</div>
          <div className="text-gray-500">{Math.round(fps)} FPS</div>
        </div>
      </div>
    </button>
  )
}