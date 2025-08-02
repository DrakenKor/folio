'use client'

import React from 'react'
import { MathVisualization, VisualizationState, VisualizationControl } from '@/types/math-visualization'

interface VisualizationControlsProps {
  visualization: MathVisualization
  state: VisualizationState
  onParameterChange: (key: string, value: any) => void
  onReset: () => void
}

export const VisualizationControls: React.FC<VisualizationControlsProps> = ({
  visualization,
  state,
  onParameterChange,
  onReset
}) => {
  const controls = visualization.getControls()

  const renderControl = (control: VisualizationControl) => {
    switch (control.type) {
      case 'slider':
        return (
          <div key={control.id} className="control-group mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {control.label}
            </label>
            <input
              type="range"
              min={control.min || 0}
              max={control.max || 100}
              step={control.step || 1}
              value={control.value}
              onChange={(e) => onParameterChange(control.id, parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{control.min || 0}</span>
              <span className="font-medium text-white">{control.value}</span>
              <span>{control.max || 100}</span>
            </div>
          </div>
        )

      case 'toggle':
        return (
          <div key={control.id} className="control-group mb-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={control.value}
                onChange={(e) => onParameterChange(control.id, e.target.checked)}
                className="sr-only"
              />
              <div className={`relative w-10 h-6 rounded-full transition-colors ${
                control.value ? 'bg-blue-600' : 'bg-gray-600'
              }`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  control.value ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </div>
              <span className="ml-3 text-sm font-medium text-gray-300">
                {control.label}
              </span>
            </label>
          </div>
        )

      case 'select':
        return (
          <div key={control.id} className="control-group mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {control.label}
            </label>
            <select
              value={control.value}
              onChange={(e) => onParameterChange(control.id, e.target.value)}
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white focus:border-blue-500 focus:outline-none"
            >
              {control.options?.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )

      case 'button':
        return (
          <div key={control.id} className="control-group mb-4">
            <button
              onClick={() => control.onChange(control.value)}
              className="w-full p-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              {control.label}
            </button>
          </div>
        )

      case 'color':
        return (
          <div key={control.id} className="control-group mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {control.label}
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={control.value}
                onChange={(e) => onParameterChange(control.id, e.target.value)}
                className="w-12 h-8 rounded border border-gray-600 cursor-pointer"
              />
              <span className="text-sm text-gray-400 font-mono">{control.value}</span>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="visualization-controls bg-gray-900 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Controls</h3>
        <button
          onClick={onReset}
          className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          Reset
        </button>
      </div>

      {controls.length > 0 ? (
        <div className="controls-list">
          {controls.map(renderControl)}
        </div>
      ) : (
        <p className="text-gray-400 text-sm">No controls available for this visualization.</p>
      )}

      <div className="visualization-info mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-2">About</h4>
        <p className="text-xs text-gray-400 leading-relaxed">
          {visualization.description}
        </p>
      </div>
    </div>
  )
}
