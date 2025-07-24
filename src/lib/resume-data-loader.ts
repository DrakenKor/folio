import {
  ResumeData,
  Experience,
  Education,
  SkillCategory,
  Skill,
  Project,
  TechCategory,
  Technology,
  PersonalInfo
} from '../types/resume'

/**
 * Resume Data Loader
 * Loads and parses resume data from static sources
 */
export class ResumeDataLoader {
  private static instance: ResumeDataLoader
  private resumeData: ResumeData | null = null

  private constructor() {}

  public static getInstance(): ResumeDataLoader {
    if (!ResumeDataLoader.instance) {
      ResumeDataLoader.instance = new ResumeDataLoader()
    }
    return ResumeDataLoader.instance
  }

  /**
   * Load resume data from static source
   */
  public async loadResumeData(): Promise<ResumeData> {
    if (this.resumeData) {
      return this.resumeData
    }

    try {
      // For now, we'll use hardcoded data based on the resume-data.md
      // In the future, this could load from JSON files or APIs
      this.resumeData = this.createResumeData()
      return this.resumeData
    } catch (error) {
      console.error('Failed to load resume data:', error)
      throw new Error('Unable to load resume data')
    }
  }

  /**
   * Create resume data structure from the provided information
   */
  private createResumeData(): ResumeData {
    const personal: PersonalInfo = {
      name: 'Manav Dhindsa',
      title: 'Software Engineer',
      email: 'manav.da@gmail.com',
      portfolio: 'https://manavda.net',
      linkedin: 'linkedin.com/in/manav-dhindsa',
      phone: '+81-70-9186-9933',
      about: 'Versatile Software Engineer with over 8 years of experience developing and scaling high-performance applications in the cloud. Language agnostic engineer with expertise in front-end (React, Svelte, HTML, CSS) and back-end (Python, Golang, Typescript, NodeJS) technologies. Proven track record in architecting complex software solutions with focus on performance optimization.'
    }

    const experiences: Experience[] = [
      {
        id: 'autify-2024',
        company: 'Autify Inc',
        position: 'Software Engineer',
        startDate: new Date('2024-10-01'),
        endDate: null,
        location: 'Tokyo, Japan',
        companyType: 'Startup in test automation space',
        description: 'AI-driven automated testing flagship product development',
        technologies: ['Golang', 'Ruby', 'TypeScript', 'Svelte'],
        projects: [
          {
            projectId: 'autify-core-api',
            role: 'Core API Developer',
            impact: 'Designed and architected multiple components on tight schedule'
          },
          {
            projectId: 'autify-frontend',
            role: 'Frontend Developer',
            impact: 'Frontend development with automated testing integration'
          }
        ],
        achievements: [
          'Designed and architected multiple components on tight schedule',
          'Mentored two new engineers for rapid onboarding',
          'Contributed to multilingual stack (Golang, Ruby, TypeScript)'
        ]
      },
      {
        id: 'rezinaus-2024',
        company: 'Rezinaus',
        position: 'Independent Contractor',
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-10-01'),
        location: 'Brisbane, Australia',
        companyType: 'Consulting',
        description: 'End-to-end software solutions for diverse clients',
        technologies: ['Serverless', 'AWS', 'Azure', 'Vercel', 'Supabase', 'Slack API', 'MS Teams API'],
        projects: [
          {
            projectId: 'law-firm-apps',
            role: 'Full Stack Developer',
            impact: 'Built comprehensive law firm applications'
          },
          {
            projectId: 'saas-products',
            role: 'Solution Architect',
            impact: 'Developed multiple SaaS products'
          },
          {
            projectId: 'web3-crypto',
            role: 'Blockchain Developer',
            impact: 'Web3 Crypto Startup projects'
          }
        ],
        achievements: [
          'Architected both serverless & stateful solutions',
          'Integrated multiple third-party APIs',
          'Rapid delivery with transparent communication'
        ]
      },
      {
        id: 'stafflink-2022',
        company: 'StaffLink',
        position: 'Devops Lead / Lead Fullstack',
        startDate: new Date('2022-01-01'),
        endDate: new Date('2024-02-01'),
        location: 'Brisbane, Australia',
        companyType: 'PropTech Startup',
        description: 'Multi-tenancy PropTech web application development',
        technologies: ['React', 'Node.js', 'TypeScript', 'GraphQL', 'PostgreSQL', 'AWS CDK'],
        projects: [
          {
            projectId: 'proptech-platform',
            role: 'Lead Devops/Fullstack Engineer',
            impact: 'Scaled to thousands of monthly active users'
          },
          {
            projectId: 'typescript-migration',
            role: 'Migration Lead',
            impact: 'Zero downtime TypeScript migration'
          }
        ],
        achievements: [
          'Scaled to thousands of monthly active users',
          'Zero downtime TypeScript migration',
          'Established E2E, Integration, and Unit testing',
          'Mentored junior developers',
          'Managed DevOps and CI/CD pipelines'
        ]
      },
      {
        id: 'littles-lawyers-2018',
        company: 'Littles Lawyers',
        position: 'Fullstack Engineer',
        startDate: new Date('2018-01-01'),
        endDate: new Date('2022-01-01'),
        location: 'Brisbane, Australia',
        companyType: 'LegalTech startup',
        description: 'ML-assisted legal document classification and management systems',
        technologies: ['React', 'TypeScript', 'Node.js', 'Python', 'GraphQL', 'AWS S3', 'Terraform'],
        projects: [
          {
            projectId: 'ml-document-classification',
            role: 'Full Stack Developer',
            impact: 'Built ML-assisted legal document classification system'
          },
          {
            projectId: 'document-bundling',
            role: 'Lead Developer',
            impact: 'Document bundling application with complex interfaces'
          },
          {
            projectId: 'data-migration',
            role: 'Migration Specialist',
            impact: 'Managed migration of 1M+ documents'
          }
        ],
        achievements: [
          'Built complex drag & drop interfaces',
          'Implemented Slack integrations',
          'Managed hybrid cloud environment',
          'Led digital transformation initiative',
          'Optimized GraphQL and database performance'
        ]
      },
      {
        id: 'phoenix-consulting-2017',
        company: 'Phoenix Consulting',
        position: 'Software Developer/Consultant',
        startDate: new Date('2017-01-01'),
        endDate: new Date('2018-01-01'),
        location: 'Bangalore, India',
        companyType: 'Consulting',
        description: 'Car dealership CRM software and legacy system migration',
        technologies: ['Python', 'JavaScript', 'HTML', 'CSS', 'XML', 'Azure', 'Selenium'],
        projects: [
          {
            projectId: 'crm-software',
            role: 'Full Stack Developer',
            impact: 'Car dealership CRM software development'
          },
          {
            projectId: 'legacy-migration',
            role: 'Migration Specialist',
            impact: 'Legacy system migration to cloud'
          }
        ],
        achievements: [
          'Reduced manual testing time by 70% with automation',
          'Implemented CI/CD pipelines',
          'Migrated legacy systems to cloud'
        ]
      }
    ]

    const education: Education[] = [
      {
        id: 'griffith-university',
        institution: 'Griffith University',
        degree: 'Bachelor of Information Technology',
        major: 'Computer Science, Software Engineering',
        startDate: new Date('2014-01-01'),
        endDate: new Date('2017-12-01'),
        location: 'Brisbane, Australia'
      },
      {
        id: 'qibt',
        institution: 'Queensland Institute of Business and Technology',
        degree: 'Diploma of Information Technology',
        startDate: new Date('2013-01-01'),
        endDate: new Date('2014-12-01'),
        location: 'Brisbane, Australia'
      }
    ]

    const skillCategories: SkillCategory[] = [
      {
        name: 'Frontend',
        color: '#61DAFB',
        icon: 'frontend',
        skills: [
          { name: 'React', proficiency: 95, yearsOfExperience: 6, projects: ['stafflink', 'littles-lawyers'], category: TechCategory.FRONTEND },
          { name: 'TypeScript', proficiency: 90, yearsOfExperience: 5, projects: ['autify', 'stafflink', 'littles-lawyers'], category: TechCategory.FRONTEND },
          { name: 'Svelte', proficiency: 80, yearsOfExperience: 1, projects: ['autify'], category: TechCategory.FRONTEND },
          { name: 'JavaScript', proficiency: 95, yearsOfExperience: 8, projects: ['all'], category: TechCategory.FRONTEND },
          { name: 'HTML5', proficiency: 95, yearsOfExperience: 8, projects: ['all'], category: TechCategory.FRONTEND },
          { name: 'CSS3', proficiency: 90, yearsOfExperience: 8, projects: ['all'], category: TechCategory.FRONTEND }
        ]
      },
      {
        name: 'Backend',
        color: '#68D391',
        icon: 'backend',
        skills: [
          { name: 'Node.js', proficiency: 90, yearsOfExperience: 6, projects: ['stafflink', 'littles-lawyers'], category: TechCategory.BACKEND },
          { name: 'Python', proficiency: 85, yearsOfExperience: 5, projects: ['littles-lawyers', 'phoenix-consulting'], category: TechCategory.BACKEND },
          { name: 'Golang', proficiency: 85, yearsOfExperience: 2, projects: ['autify'], category: TechCategory.BACKEND },
          { name: 'Ruby', proficiency: 70, yearsOfExperience: 1, projects: ['autify'], category: TechCategory.BACKEND }
        ]
      },
      {
        name: 'Database',
        color: '#F6AD55',
        icon: 'database',
        skills: [
          { name: 'PostgreSQL', proficiency: 90, yearsOfExperience: 5, projects: ['stafflink', 'littles-lawyers'], category: TechCategory.DATABASE },
          { name: 'MySQL', proficiency: 80, yearsOfExperience: 4, projects: ['phoenix-consulting'], category: TechCategory.DATABASE },
          { name: 'NoSQL', proficiency: 75, yearsOfExperience: 3, projects: ['rezinaus'], category: TechCategory.DATABASE }
        ]
      },
      {
        name: 'Cloud & DevOps',
        color: '#9F7AEA',
        icon: 'cloud',
        skills: [
          { name: 'AWS', proficiency: 90, yearsOfExperience: 5, projects: ['stafflink', 'littles-lawyers', 'rezinaus'], category: TechCategory.CLOUD },
          { name: 'Azure', proficiency: 80, yearsOfExperience: 3, projects: ['rezinaus', 'phoenix-consulting'], category: TechCategory.CLOUD },
          { name: 'Docker', proficiency: 85, yearsOfExperience: 4, projects: ['stafflink', 'littles-lawyers'], category: TechCategory.DEVOPS },
          { name: 'Terraform', proficiency: 80, yearsOfExperience: 3, projects: ['littles-lawyers'], category: TechCategory.DEVOPS }
        ]
      }
    ]

    const projects: Project[] = [
      {
        id: 'autify-core-api',
        name: 'Autify Core API',
        description: 'Core API service for AI-driven automated testing platform',
        technologies: ['Golang', 'Ruby', 'TypeScript'],
        achievements: ['Designed scalable architecture', 'Implemented efficient testing workflows'],
        company: 'Autify Inc'
      },
      {
        id: 'proptech-platform',
        name: 'PropTech Platform',
        description: 'Multi-tenant property management platform',
        technologies: ['React', 'Node.js', 'TypeScript', 'GraphQL', 'PostgreSQL'],
        achievements: ['Scaled to thousands of users', 'Zero downtime migrations'],
        company: 'StaffLink'
      },
      {
        id: 'ml-document-classification',
        name: 'ML Document Classification System',
        description: 'Machine learning system for legal document classification',
        technologies: ['Python', 'React', 'Node.js', 'AWS S3'],
        achievements: ['Processed 1M+ documents', 'Improved classification accuracy by 40%'],
        company: 'Littles Lawyers'
      }
    ]

    return {
      personal,
      experience: experiences,
      education,
      skills: skillCategories,
      projects
    }
  }

  /**
   * Get experiences sorted by date (newest first)
   */
  public async getExperiencesSorted(): Promise<Experience[]> {
    const data = await this.loadResumeData()
    return data.experience.sort((a, b) => {
      const aDate = a.endDate || new Date()
      const bDate = b.endDate || new Date()
      return bDate.getTime() - aDate.getTime()
    })
  }

  /**
   * Get skills by category
   */
  public async getSkillsByCategory(category: TechCategory): Promise<Skill[]> {
    const data = await this.loadResumeData()
    return data.skills
      .flatMap(skillCategory => skillCategory.skills)
      .filter(skill => skill.category === category)
  }

  /**
   * Get technologies used in a specific experience
   */
  public async getTechnologiesForExperience(experienceId: string): Promise<Technology[]> {
    const data = await this.loadResumeData()
    const experience = data.experience.find(exp => exp.id === experienceId)

    if (!experience) {
      return []
    }

    // Convert technology names to Technology objects with additional metadata
    return experience.technologies.map(techName => {
      const skill = data.skills
        .flatMap(category => category.skills)
        .find(skill => skill.name === techName)

      return {
        name: techName,
        category: skill?.category || TechCategory.OTHER,
        proficiency: skill?.proficiency || 50,
        color: this.getTechnologyColor(techName),
        yearsUsed: skill?.yearsOfExperience || 1,
        projects: skill?.projects || [experienceId]
      }
    })
  }

  /**
   * Get color for technology based on category
   */
  private getTechnologyColor(techName: string): string {
    const colorMap: Record<string, string> = {
      'React': '#61DAFB',
      'TypeScript': '#3178C6',
      'JavaScript': '#F7DF1E',
      'Node.js': '#339933',
      'Python': '#3776AB',
      'Golang': '#00ADD8',
      'Ruby': '#CC342D',
      'PostgreSQL': '#336791',
      'AWS': '#FF9900',
      'Azure': '#0078D4',
      'Docker': '#2496ED',
      'GraphQL': '#E10098'
    }

    return colorMap[techName] || '#6B7280'
  }
}
