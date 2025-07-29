// Types for Code Architecture Visualizer
import { Vector3 } from 'three'

export interface CodeNode {
  id: string
  name: string
  type: NodeType
  size: number
  dependencies: string[]
  position3D: Vector3
  metadata: NodeMetadata
  color?: string
  icon?: string
}

export interface CodeEdge {
  id: string
  source: string
  target: string
  type: EdgeType
  weight: number
  metadata: EdgeMetadata
}

export interface CodeGraph {
  id: string
  name: string
  description: string
  nodes: CodeNode[]
  edges: CodeEdge[]
  layout: GraphLayout
  metadata: ProjectMetadata
}

export enum NodeType {
  FILE = 'file',
  DIRECTORY = 'directory',
  FUNCTION = 'function',
  CLASS = 'class',
  MODULE = 'module',
  COMPONENT = 'component',
  SERVICE = 'service',
  DATABASE = 'database',
  API = 'api',
  LIBRARY = 'library'
}

export enum EdgeType {
  IMPORT = 'import',
  DEPENDENCY = 'dependency',
  INHERITANCE = 'inheritance',
  COMPOSITION = 'composition',
  CALL = 'call',
  DATA_FLOW = 'data_flow'
}

export interface NodeMetadata {
  language: string
  linesOfCode?: number
  complexity?: number
  lastModified?: Date
  author?: string
  description?: string
  technologies: string[]
  filePath?: string
}

export interface EdgeMetadata {
  strength: number
  frequency?: number
  description?: string
}

export interface GraphLayout {
  algorithm: LayoutAlgorithm
  parameters: LayoutParameters
  bounds: {
    min: Vector3
    max: Vector3
  }
}

export enum LayoutAlgorithm {
  FORCE_DIRECTED = 'force_directed',
  HIERARCHICAL = 'hierarchical',
  CIRCULAR = 'circular',
  TREE = 'tree',
  GRID = 'grid'
}

export interface LayoutParameters {
  nodeSpacing: number
  edgeLength: number
  repulsionStrength: number
  attractionStrength: number
  iterations: number
}

export interface ProjectMetadata {
  name: string
  description: string
  technologies: string[]
  startDate: Date
  endDate?: Date
  company: string
  role: string
  teamSize: number
  architecture: ArchitectureType
}

export enum ArchitectureType {
  MONOLITH = 'monolith',
  MICROSERVICES = 'microservices',
  SERVERLESS = 'serverless',
  HYBRID = 'hybrid'
}

export interface TechnologyMigration {
  id: string
  name: string
  description: string
  fromTechnology: string
  toTechnology: string
  startDate: Date
  endDate: Date
  phases: MigrationPhase[]
  impact: MigrationImpact
}

export interface MigrationPhase {
  id: string
  name: string
  description: string
  startDate: Date
  endDate: Date
  progress: number // 0-100
  changes: CodeChange[]
}

export interface CodeChange {
  id: string
  type: ChangeType
  description: string
  filesAffected: string[]
  linesChanged: number
}

export enum ChangeType {
  REFACTOR = 'refactor',
  MIGRATION = 'migration',
  NEW_FEATURE = 'new_feature',
  BUG_FIX = 'bug_fix',
  OPTIMIZATION = 'optimization'
}

export interface MigrationImpact {
  performanceImprovement: number
  maintainabilityScore: number
  securityEnhancement: number
  developerExperience: number
}

export interface FileTreeNode {
  id: string
  name: string
  type: 'file' | 'directory'
  size: number
  children?: FileTreeNode[]
  position3D: Vector3
  metadata: FileMetadata
}

export interface FileMetadata {
  extension?: string
  language?: string
  linesOfCode?: number
  lastModified: Date
  author: string
  description?: string
}
