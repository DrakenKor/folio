import { Vector3 } from 'three'

// Core resume data types
export interface ResumeData {
  personal: PersonalInfo
  experience: Experience[]
  education: Education[]
  skills: SkillCategory[]
  projects: Project[]
}

export interface PersonalInfo {
  name: string
  title: string
  email: string
  portfolio: string
  linkedin: string
  phone: string
  about: string
}

export interface Experience {
  id: string
  company: string
  position: string
  startDate: Date
  endDate: Date | null
  location: string
  companyType: string
  description: string
  technologies: string[]
  projects: ProjectReference[]
  achievements: string[]
  // 3D positioning data
  position3D?: Vector3
  timelineIndex?: number
}

export interface Education {
  id: string
  institution: string
  degree: string
  major?: string
  startDate: Date
  endDate: Date
  location: string
}

export interface SkillCategory {
  name: string
  skills: Skill[]
  color: string
  icon: string
}

export interface Skill {
  name: string
  proficiency: number // 0-100
  yearsOfExperience: number
  projects: string[]
  category: TechCategory
}

export interface Project {
  id: string
  name: string
  description: string
  technologies: string[]
  achievements: string[]
  duration?: DateRange
  company?: string
}

export interface ProjectReference {
  projectId: string
  role: string
  impact: string
}

export interface DateRange {
  start: Date
  end: Date | null
}

export enum TechCategory {
  FRONTEND = 'frontend',
  BACKEND = 'backend',
  DATABASE = 'database',
  CLOUD = 'cloud',
  DEVOPS = 'devops',
  TESTING = 'testing',
  MOBILE = 'mobile',
  OTHER = 'other'
}

// Timeline-specific types
export interface TimelineData {
  experiences: TimelineExperience[]
  totalDuration: number
  startDate: Date
  endDate: Date
  helixConfig: HelixConfig
}

export interface TimelineExperience extends Experience {
  position3D: Vector3
  timelineIndex: number
  normalizedTime: number // 0-1 along timeline
  cardRotation: Vector3
  connectionPoints: Vector3[]
}

export interface HelixConfig {
  radius: number
  height: number
  turns: number
  segments: number
  curve?: THREE.CatmullRomCurve3
}

// Technology visualization types
export interface Technology {
  name: string
  category: TechCategory
  proficiency: number
  color: string
  icon?: string
  yearsUsed: number
  projects: string[]
}

export interface TechnologyStack {
  experience: string
  technologies: Technology[]
  primaryTech: string[]
  secondaryTech: string[]
}

// Timeline position calculation types
export interface TimelinePosition {
  experienceId: string
  position3D: Vector3
  rotation: Vector3
  normalizedTime: number
  index: number
}

export interface TimelineCalculationConfig {
  startRadius: number
  endRadius: number
  totalHeight: number
  helixTurns: number
  experienceSpacing: number
  verticalOffset: number
}
