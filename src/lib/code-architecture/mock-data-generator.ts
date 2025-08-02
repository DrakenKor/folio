import { Vector3 } from 'three'
import {
  CodeGraph,
  CodeNode,
  CodeEdge,
  NodeType,
  EdgeType,
  LayoutAlgorithm,
  ArchitectureType,
  TechnologyMigration,
  MigrationPhase,
  ChangeType,
  FileTreeNode
} from '../../types/code-architecture'

export class MockDataGenerator {
  private static nodeIdCounter = 0
  private static edgeIdCounter = 0

  static generateProjectGraphs(): CodeGraph[] {
    return [
      this.generateStaffLinkGraph(),
      this.generateLittleLawyersGraph(),
      this.generateAutifyGraph(),
      this.generateRezinausGraph(),
      this.generatePhoenixGraph()
    ]
  }

  private static generateStaffLinkGraph(): CodeGraph {
    const nodes: CodeNode[] = [
      // Frontend Components
      this.createNode('react-app', 'React Application', NodeType.MODULE, 150, [], '#61DAFB'),
      this.createNode('property-list', 'PropertyList Component', NodeType.COMPONENT, 80, ['react-app'], '#61DAFB'),
      this.createNode('tenant-dashboard', 'TenantDashboard Component', NodeType.COMPONENT, 120, ['react-app'], '#61DAFB'),
      this.createNode('auth-provider', 'AuthProvider', NodeType.SERVICE, 60, ['react-app'], '#61DAFB'),

      // Backend Services
      this.createNode('graphql-api', 'GraphQL API', NodeType.API, 200, [], '#E10098'),
      this.createNode('property-service', 'Property Service', NodeType.SERVICE, 100, ['graphql-api'], '#3178C6'),
      this.createNode('tenant-service', 'Tenant Service', NodeType.SERVICE, 90, ['graphql-api'], '#3178C6'),
      this.createNode('auth-service', 'Auth Service', NodeType.SERVICE, 70, ['graphql-api'], '#3178C6'),

      // Database
      this.createNode('postgresql', 'PostgreSQL Database', NodeType.DATABASE, 180, [], '#336791'),
      this.createNode('property-table', 'Properties Table', NodeType.DATABASE, 50, ['postgresql'], '#336791'),
      this.createNode('tenant-table', 'Tenants Table', NodeType.DATABASE, 45, ['postgresql'], '#336791'),
      this.createNode('user-table', 'Users Table', NodeType.DATABASE, 40, ['postgresql'], '#336791'),

      // Infrastructure
      this.createNode('aws-cdk', 'AWS CDK', NodeType.MODULE, 90, [], '#FF9900'),
      this.createNode('lambda-functions', 'Lambda Functions', NodeType.SERVICE, 110, ['aws-cdk'], '#FF9900'),
      this.createNode('api-gateway', 'API Gateway', NodeType.SERVICE, 60, ['aws-cdk'], '#FF9900')
    ]

    const edges: CodeEdge[] = [
      this.createEdge('property-list', 'graphql-api', EdgeType.DEPENDENCY, 0.8),
      this.createEdge('tenant-dashboard', 'graphql-api', EdgeType.DEPENDENCY, 0.9),
      this.createEdge('auth-provider', 'auth-service', EdgeType.DEPENDENCY, 0.7),
      this.createEdge('property-service', 'property-table', EdgeType.DATA_FLOW, 0.9),
      this.createEdge('tenant-service', 'tenant-table', EdgeType.DATA_FLOW, 0.8),
      this.createEdge('auth-service', 'user-table', EdgeType.DATA_FLOW, 0.7),
      this.createEdge('graphql-api', 'lambda-functions', EdgeType.DEPENDENCY, 0.6),
      this.createEdge('lambda-functions', 'api-gateway', EdgeType.DEPENDENCY, 0.5)
    ]

    return {
      id: 'stafflink-proptech',
      name: 'StaffLink PropTech Platform',
      description: 'Multi-tenancy PropTech web application with GraphQL API',
      nodes,
      edges,
      layout: {
        algorithm: LayoutAlgorithm.FORCE_DIRECTED,
        parameters: {
          nodeSpacing: 5,
          edgeLength: 8,
          repulsionStrength: 100,
          attractionStrength: 0.1,
          iterations: 1000
        },
        bounds: {
          min: new Vector3(-20, -20, -20),
          max: new Vector3(20, 20, 20)
        }
      },
      metadata: {
        name: 'StaffLink PropTech Platform',
        description: 'Scalable multi-tenant property management system',
        technologies: ['React', 'TypeScript', 'GraphQL', 'PostgreSQL', 'AWS CDK'],
        startDate: new Date('2022-01-01'),
        endDate: new Date('2024-02-01'),
        company: 'StaffLink',
        role: 'DevOps Lead',
        teamSize: 5,
        architecture: ArchitectureType.MICROSERVICES
      }
    }
  }

  private static generateLittleLawyersGraph(): CodeGraph {
    const nodes: CodeNode[] = [
      // ML Document Classification System
      this.createNode('ml-classifier', 'ML Document Classifier', NodeType.SERVICE, 180, [], '#FF6B6B'),
      this.createNode('document-processor', 'Document Processor', NodeType.SERVICE, 120, ['ml-classifier'], '#4ECDC4'),
      this.createNode('feature-extractor', 'Feature Extractor', NodeType.MODULE, 90, ['document-processor'], '#45B7D1'),
      this.createNode('classification-model', 'Classification Model', NodeType.MODULE, 100, ['ml-classifier'], '#96CEB4'),

      // Document Bundling System
      this.createNode('bundling-service', 'Document Bundling Service', NodeType.SERVICE, 140, [], '#FFEAA7'),
      this.createNode('drag-drop-ui', 'Drag & Drop Interface', NodeType.COMPONENT, 110, ['bundling-service'], '#DDA0DD'),
      this.createNode('bundle-generator', 'Bundle Generator', NodeType.MODULE, 80, ['bundling-service'], '#98D8C8'),

      // Data Storage
      this.createNode('aws-s3', 'AWS S3 Storage', NodeType.DATABASE, 160, [], '#FF9900'),
      this.createNode('document-metadata', 'Document Metadata DB', NodeType.DATABASE, 70, ['aws-s3'], '#336791'),

      // Analytics Dashboard
      this.createNode('analytics-dashboard', 'Analytics Dashboard', NodeType.COMPONENT, 130, [], '#74B9FF'),
      this.createNode('metrics-service', 'Metrics Service', NodeType.SERVICE, 85, ['analytics-dashboard'], '#A29BFE'),

      // Integration Services
      this.createNode('slack-integration', 'Slack Integration', NodeType.SERVICE, 60, [], '#4A154B'),
      this.createNode('graphql-api', 'GraphQL API', NodeType.API, 150, [], '#E10098')
    ]

    const edges: CodeEdge[] = [
      this.createEdge('document-processor', 'feature-extractor', EdgeType.CALL, 0.9),
      this.createEdge('ml-classifier', 'classification-model', EdgeType.DEPENDENCY, 0.8),
      this.createEdge('document-processor', 'aws-s3', EdgeType.DATA_FLOW, 0.7),
      this.createEdge('bundling-service', 'bundle-generator', EdgeType.CALL, 0.8),
      this.createEdge('drag-drop-ui', 'bundling-service', EdgeType.DEPENDENCY, 0.9),
      this.createEdge('bundle-generator', 'aws-s3', EdgeType.DATA_FLOW, 0.6),
      this.createEdge('analytics-dashboard', 'metrics-service', EdgeType.DEPENDENCY, 0.7),
      this.createEdge('metrics-service', 'document-metadata', EdgeType.DATA_FLOW, 0.5),
      this.createEdge('slack-integration', 'graphql-api', EdgeType.DEPENDENCY, 0.4)
    ]

    return {
      id: 'littles-lawyers-legaltech',
      name: 'Littles Lawyers LegalTech System',
      description: 'ML-assisted legal document classification and bundling system',
      nodes,
      edges,
      layout: {
        algorithm: LayoutAlgorithm.HIERARCHICAL,
        parameters: {
          nodeSpacing: 6,
          edgeLength: 10,
          repulsionStrength: 80,
          attractionStrength: 0.15,
          iterations: 800
        },
        bounds: {
          min: new Vector3(-25, -25, -25),
          max: new Vector3(25, 25, 25)
        }
      },
      metadata: {
        name: 'Littles Lawyers LegalTech System',
        description: 'AI-powered document management and classification platform',
        technologies: ['React', 'TypeScript', 'Python', 'GraphQL', 'AWS S3', 'Machine Learning'],
        startDate: new Date('2018-01-01'),
        endDate: new Date('2022-01-01'),
        company: 'Littles Lawyers',
        role: 'Fullstack Engineer',
        teamSize: 3,
        architecture: ArchitectureType.HYBRID
      }
    }
  }

  private static generateAutifyGraph(): CodeGraph {
    const nodes: CodeNode[] = [
      // AI Testing Core
      this.createNode('ai-test-engine', 'AI Test Engine', NodeType.SERVICE, 200, [], '#FF6B35'),
      this.createNode('test-recorder', 'Test Recorder', NodeType.MODULE, 120, ['ai-test-engine'], '#F7931E'),
      this.createNode('ai-analyzer', 'AI Analyzer', NodeType.MODULE, 150, ['ai-test-engine'], '#FFD23F'),
      this.createNode('test-executor', 'Test Executor', NodeType.MODULE, 110, ['ai-test-engine'], '#06FFA5'),

      // Frontend Components
      this.createNode('svelte-ui', 'Svelte UI', NodeType.COMPONENT, 140, [], '#FF3E00'),
      this.createNode('test-dashboard', 'Test Dashboard', NodeType.COMPONENT, 100, ['svelte-ui'], '#FF3E00'),
      this.createNode('result-viewer', 'Result Viewer', NodeType.COMPONENT, 90, ['svelte-ui'], '#FF3E00'),

      // Backend Services
      this.createNode('golang-api', 'Golang API', NodeType.API, 180, [], '#00ADD8'),
      this.createNode('ruby-services', 'Ruby Services', NodeType.SERVICE, 160, [], '#CC342D'),
      this.createNode('typescript-utils', 'TypeScript Utils', NodeType.MODULE, 80, [], '#3178C6'),

      // Data Layer
      this.createNode('test-results-db', 'Test Results Database', NodeType.DATABASE, 120, [], '#336791'),
      this.createNode('ai-models-store', 'AI Models Store', NodeType.DATABASE, 100, [], '#FF6B6B')
    ]

    const edges: CodeEdge[] = [
      this.createEdge('test-recorder', 'ai-analyzer', EdgeType.DATA_FLOW, 0.9),
      this.createEdge('ai-analyzer', 'test-executor', EdgeType.CALL, 0.8),
      this.createEdge('test-dashboard', 'golang-api', EdgeType.DEPENDENCY, 0.7),
      this.createEdge('result-viewer', 'golang-api', EdgeType.DEPENDENCY, 0.6),
      this.createEdge('golang-api', 'ruby-services', EdgeType.CALL, 0.8),
      this.createEdge('ruby-services', 'test-results-db', EdgeType.DATA_FLOW, 0.7),
      this.createEdge('ai-analyzer', 'ai-models-store', EdgeType.DATA_FLOW, 0.9),
      this.createEdge('typescript-utils', 'svelte-ui', EdgeType.DEPENDENCY, 0.5)
    ]

    return {
      id: 'autify-ai-testing',
      name: 'Autify AI Testing Platform',
      description: 'AI-driven automated testing flagship product',
      nodes,
      edges,
      layout: {
        algorithm: LayoutAlgorithm.CIRCULAR,
        parameters: {
          nodeSpacing: 7,
          edgeLength: 12,
          repulsionStrength: 120,
          attractionStrength: 0.12,
          iterations: 600
        },
        bounds: {
          min: new Vector3(-30, -30, -30),
          max: new Vector3(30, 30, 30)
        }
      },
      metadata: {
        name: 'Autify AI Testing Platform',
        description: 'Next-generation AI-powered test automation platform',
        technologies: ['Golang', 'Ruby', 'TypeScript', 'Svelte', 'AI/ML'],
        startDate: new Date('2024-10-01'),
        company: 'Autify Inc',
        role: 'Software Engineer',
        teamSize: 8,
        architecture: ArchitectureType.MICROSERVICES
      }
    }
  }

  private static generateRezinausGraph(): CodeGraph {
    const nodes: CodeNode[] = [
      // Serverless Architecture
      this.createNode('serverless-functions', 'Serverless Functions', NodeType.SERVICE, 160, [], '#FD79A8'),
      this.createNode('aws-lambda', 'AWS Lambda', NodeType.SERVICE, 120, ['serverless-functions'], '#FF9900'),
      this.createNode('azure-functions', 'Azure Functions', NodeType.SERVICE, 110, ['serverless-functions'], '#0078D4'),
      this.createNode('vercel-edge', 'Vercel Edge Functions', NodeType.SERVICE, 100, ['serverless-functions'], '#000000'),

      // API Integrations
      this.createNode('slack-api', 'Slack API Integration', NodeType.API, 90, [], '#4A154B'),
      this.createNode('teams-api', 'MS Teams API Integration', NodeType.API, 85, [], '#6264A7'),
      this.createNode('supabase-api', 'Supabase API', NodeType.API, 95, [], '#3ECF8E'),

      // Client Solutions
      this.createNode('law-firm-app', 'Law Firm Application', NodeType.MODULE, 140, [], '#A0522D'),
      this.createNode('saas-product', 'SaaS Product', NodeType.MODULE, 130, [], '#20B2AA'),
      this.createNode('esports-solution', 'Esports Team Solution', NodeType.MODULE, 120, [], '#FF1493'),
      this.createNode('web3-crypto', 'Web3 Crypto Startup', NodeType.MODULE, 110, [], '#FFD700'),

      // Data Layer
      this.createNode('multi-db', 'Multi-Database Layer', NodeType.DATABASE, 100, [], '#8A2BE2')
    ]

    const edges: CodeEdge[] = [
      this.createEdge('law-firm-app', 'aws-lambda', EdgeType.DEPENDENCY, 0.8),
      this.createEdge('saas-product', 'azure-functions', EdgeType.DEPENDENCY, 0.7),
      this.createEdge('esports-solution', 'vercel-edge', EdgeType.DEPENDENCY, 0.6),
      this.createEdge('web3-crypto', 'supabase-api', EdgeType.DEPENDENCY, 0.9),
      this.createEdge('slack-api', 'serverless-functions', EdgeType.CALL, 0.5),
      this.createEdge('teams-api', 'serverless-functions', EdgeType.CALL, 0.4),
      this.createEdge('serverless-functions', 'multi-db', EdgeType.DATA_FLOW, 0.7)
    ]

    return {
      id: 'rezinaus-solutions',
      name: 'Rezinaus Client Solutions',
      description: 'End-to-end serverless solutions for diverse clients',
      nodes,
      edges,
      layout: {
        algorithm: LayoutAlgorithm.TREE,
        parameters: {
          nodeSpacing: 8,
          edgeLength: 15,
          repulsionStrength: 90,
          attractionStrength: 0.08,
          iterations: 500
        },
        bounds: {
          min: new Vector3(-35, -35, -35),
          max: new Vector3(35, 35, 35)
        }
      },
      metadata: {
        name: 'Rezinaus Client Solutions',
        description: 'Diverse serverless and cloud-native solutions',
        technologies: ['Serverless', 'AWS', 'Azure', 'Vercel', 'Supabase', 'Slack API', 'MS Teams API'],
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-10-01'),
        company: 'Rezinaus',
        role: 'Independent Contractor',
        teamSize: 1,
        architecture: ArchitectureType.SERVERLESS
      }
    }
  }

  private static generatePhoenixGraph(): CodeGraph {
    const nodes: CodeNode[] = [
      // CRM System
      this.createNode('crm-system', 'Car Dealership CRM', NodeType.MODULE, 180, [], '#FF7675'),
      this.createNode('customer-module', 'Customer Management', NodeType.MODULE, 100, ['crm-system'], '#74B9FF'),
      this.createNode('inventory-module', 'Inventory Management', NodeType.MODULE, 110, ['crm-system'], '#00B894'),
      this.createNode('sales-module', 'Sales Tracking', NodeType.MODULE, 90, ['crm-system'], '#FDCB6E'),

      // API Layer
      this.createNode('rest-api', 'RESTful API', NodeType.API, 140, [], '#6C5CE7'),
      this.createNode('python-backend', 'Python Backend', NodeType.SERVICE, 120, ['rest-api'], '#3776AB'),

      // Legacy Migration
      this.createNode('legacy-system', 'Legacy System', NodeType.MODULE, 160, [], '#636E72'),
      this.createNode('migration-service', 'Migration Service', NodeType.SERVICE, 80, [], '#00CEC9'),

      // Testing & CI/CD
      this.createNode('selenium-tests', 'Selenium Test Suite', NodeType.MODULE, 70, [], '#43A047'),
      this.createNode('cicd-pipeline', 'CI/CD Pipeline', NodeType.SERVICE, 60, [], '#FF5722'),

      // Cloud Infrastructure
      this.createNode('azure-cloud', 'Azure Cloud', NodeType.SERVICE, 150, [], '#0078D4')
    ]

    const edges: CodeEdge[] = [
      this.createEdge('customer-module', 'rest-api', EdgeType.DEPENDENCY, 0.8),
      this.createEdge('inventory-module', 'rest-api', EdgeType.DEPENDENCY, 0.7),
      this.createEdge('sales-module', 'rest-api', EdgeType.DEPENDENCY, 0.9),
      this.createEdge('rest-api', 'python-backend', EdgeType.CALL, 0.9),
      this.createEdge('migration-service', 'legacy-system', EdgeType.DATA_FLOW, 0.6),
      this.createEdge('migration-service', 'crm-system', EdgeType.DATA_FLOW, 0.7),
      this.createEdge('selenium-tests', 'crm-system', EdgeType.DEPENDENCY, 0.5),
      this.createEdge('cicd-pipeline', 'azure-cloud', EdgeType.DEPENDENCY, 0.4),
      this.createEdge('python-backend', 'azure-cloud', EdgeType.DEPENDENCY, 0.8)
    ]

    return {
      id: 'phoenix-crm',
      name: 'Phoenix CRM System',
      description: 'Car dealership CRM with legacy system migration',
      nodes,
      edges,
      layout: {
        algorithm: LayoutAlgorithm.GRID,
        parameters: {
          nodeSpacing: 6,
          edgeLength: 10,
          repulsionStrength: 70,
          attractionStrength: 0.2,
          iterations: 400
        },
        bounds: {
          min: new Vector3(-20, -20, -20),
          max: new Vector3(20, 20, 20)
        }
      },
      metadata: {
        name: 'Phoenix CRM System',
        description: 'Comprehensive CRM solution with cloud migration',
        technologies: ['Python', 'JavaScript', 'Azure', 'Selenium', 'RESTful APIs'],
        startDate: new Date('2017-01-01'),
        endDate: new Date('2018-01-01'),
        company: 'Phoenix Consulting',
        role: 'Software Developer/Consultant',
        teamSize: 4,
        architecture: ArchitectureType.MONOLITH
      }
    }
  }

  static generateTechnologyMigrations(): TechnologyMigration[] {
    return [
      {
        id: 'js-to-ts-migration',
        name: 'JavaScript to TypeScript Migration',
        description: 'Complete migration from JavaScript to TypeScript at StaffLink',
        fromTechnology: 'JavaScript',
        toTechnology: 'TypeScript',
        startDate: new Date('2022-06-01'),
        endDate: new Date('2023-03-01'),
        phases: [
          {
            id: 'phase-1',
            name: 'Setup and Configuration',
            description: 'TypeScript configuration and build setup',
            startDate: new Date('2022-06-01'),
            endDate: new Date('2022-07-01'),
            progress: 100,
            changes: [
              {
                id: 'change-1',
                type: ChangeType.MIGRATION,
                description: 'Added TypeScript configuration files',
                filesAffected: ['tsconfig.json', 'webpack.config.js'],
                linesChanged: 150
              }
            ]
          },
          {
            id: 'phase-2',
            name: 'Core Components Migration',
            description: 'Migrate core React components to TypeScript',
            startDate: new Date('2022-07-01'),
            endDate: new Date('2022-10-01'),
            progress: 100,
            changes: [
              {
                id: 'change-2',
                type: ChangeType.MIGRATION,
                description: 'Converted React components to TypeScript',
                filesAffected: ['src/components/*.tsx'],
                linesChanged: 2500
              }
            ]
          },
          {
            id: 'phase-3',
            name: 'API and Services Migration',
            description: 'Migrate backend services and API endpoints',
            startDate: new Date('2022-10-01'),
            endDate: new Date('2023-03-01'),
            progress: 100,
            changes: [
              {
                id: 'change-3',
                type: ChangeType.MIGRATION,
                description: 'Converted Node.js services to TypeScript',
                filesAffected: ['src/services/*.ts', 'src/api/*.ts'],
                linesChanged: 3200
              }
            ]
          }
        ],
        impact: {
          performanceImprovement: 15,
          maintainabilityScore: 85,
          securityEnhancement: 25,
          developerExperience: 90
        }
      },
      {
        id: 'blob-to-s3-migration',
        name: 'Database Blob to S3 Migration',
        description: 'Migration from database blob storage to AWS S3 at Littles Lawyers',
        fromTechnology: 'Database Blob Storage',
        toTechnology: 'AWS S3',
        startDate: new Date('2019-03-01'),
        endDate: new Date('2019-08-01'),
        phases: [
          {
            id: 'phase-1',
            name: 'S3 Infrastructure Setup',
            description: 'Setup AWS S3 buckets and access policies',
            startDate: new Date('2019-03-01'),
            endDate: new Date('2019-04-01'),
            progress: 100,
            changes: [
              {
                id: 'change-1',
                type: ChangeType.NEW_FEATURE,
                description: 'AWS S3 bucket configuration and IAM policies',
                filesAffected: ['infrastructure/s3.tf', 'infrastructure/iam.tf'],
                linesChanged: 200
              }
            ]
          },
          {
            id: 'phase-2',
            name: 'Data Migration',
            description: 'Migrate 1M+ documents from database to S3',
            startDate: new Date('2019-04-01'),
            endDate: new Date('2019-06-01'),
            progress: 100,
            changes: [
              {
                id: 'change-2',
                type: ChangeType.MIGRATION,
                description: 'Document migration scripts and validation',
                filesAffected: ['scripts/migrate-documents.py', 'scripts/validate-migration.py'],
                linesChanged: 800
              }
            ]
          },
          {
            id: 'phase-3',
            name: 'Application Updates',
            description: 'Update application to use S3 instead of database blobs',
            startDate: new Date('2019-06-01'),
            endDate: new Date('2019-08-01'),
            progress: 100,
            changes: [
              {
                id: 'change-3',
                type: ChangeType.REFACTOR,
                description: 'Updated document service to use S3 SDK',
                filesAffected: ['src/services/document-service.ts', 'src/utils/s3-client.ts'],
                linesChanged: 1200
              }
            ]
          }
        ],
        impact: {
          performanceImprovement: 60,
          maintainabilityScore: 70,
          securityEnhancement: 40,
          developerExperience: 55
        }
      }
    ]
  }

  static generateFileTree(projectId: string): FileTreeNode {
    switch (projectId) {
      case 'stafflink-proptech':
        return this.generateStaffLinkFileTree()
      case 'littles-lawyers-legaltech':
        return this.generateLittleLawyersFileTree()
      case 'autify-ai-testing':
        return this.generateAutifyFileTree()
      default:
        return this.generateGenericFileTree(projectId)
    }
  }

  private static generateStaffLinkFileTree(): FileTreeNode {
    return {
      id: 'root',
      name: 'stafflink-proptech',
      type: 'directory',
      size: 0,
      position3D: new Vector3(0, 0, 0),
      metadata: {
        lastModified: new Date('2024-01-01'),
        author: 'Manav Dhindsa'
      },
      children: [
        {
          id: 'src',
          name: 'src',
          type: 'directory',
          size: 0,
          position3D: new Vector3(-5, 2, 0),
          metadata: {
            lastModified: new Date('2024-01-01'),
            author: 'Manav Dhindsa'
          },
          children: [
            {
              id: 'components',
              name: 'components',
              type: 'directory',
              size: 0,
              position3D: new Vector3(-8, 4, 2),
              metadata: {
                lastModified: new Date('2024-01-01'),
                author: 'Manav Dhindsa'
              },
              children: [
                {
                  id: 'PropertyList.tsx',
                  name: 'PropertyList.tsx',
                  type: 'file',
                  size: 2500,
                  position3D: new Vector3(-10, 6, 4),
                  metadata: {
                    extension: 'tsx',
                    language: 'TypeScript',
                    linesOfCode: 120,
                    lastModified: new Date('2023-12-15'),
                    author: 'Manav Dhindsa',
                    description: 'Property listing component with filtering'
                  }
                },
                {
                  id: 'TenantDashboard.tsx',
                  name: 'TenantDashboard.tsx',
                  type: 'file',
                  size: 3200,
                  position3D: new Vector3(-10, 6, 6),
                  metadata: {
                    extension: 'tsx',
                    language: 'TypeScript',
                    linesOfCode: 150,
                    lastModified: new Date('2023-12-20'),
                    author: 'Manav Dhindsa',
                    description: 'Tenant dashboard with analytics'
                  }
                }
              ]
            },
            {
              id: 'services',
              name: 'services',
              type: 'directory',
              size: 0,
              position3D: new Vector3(-8, 4, -2),
              metadata: {
                lastModified: new Date('2024-01-01'),
                author: 'Manav Dhindsa'
              },
              children: [
                {
                  id: 'property-service.ts',
                  name: 'property-service.ts',
                  type: 'file',
                  size: 4500,
                  position3D: new Vector3(-10, 6, -4),
                  metadata: {
                    extension: 'ts',
                    language: 'TypeScript',
                    linesOfCode: 200,
                    lastModified: new Date('2023-12-10'),
                    author: 'Manav Dhindsa',
                    description: 'Property management service with GraphQL integration'
                  }
                }
              ]
            }
          ]
        },
        {
          id: 'infrastructure',
          name: 'infrastructure',
          type: 'directory',
          size: 0,
          position3D: new Vector3(5, 2, 0),
          metadata: {
            lastModified: new Date('2024-01-01'),
            author: 'Manav Dhindsa'
          },
          children: [
            {
              id: 'cdk-stack.ts',
              name: 'cdk-stack.ts',
              type: 'file',
              size: 3800,
              position3D: new Vector3(8, 4, 2),
              metadata: {
                extension: 'ts',
                language: 'TypeScript',
                linesOfCode: 180,
                lastModified: new Date('2023-11-30'),
                author: 'Manav Dhindsa',
                description: 'AWS CDK infrastructure definition'
              }
            }
          ]
        }
      ]
    }
  }

  private static generateLittleLawyersFileTree(): FileTreeNode {
    return {
      id: 'root',
      name: 'littles-lawyers-system',
      type: 'directory',
      size: 0,
      position3D: new Vector3(0, 0, 0),
      metadata: {
        lastModified: new Date('2022-01-01'),
        author: 'Manav Dhindsa'
      },
      children: [
        {
          id: 'ml-classifier',
          name: 'ml-classifier',
          type: 'directory',
          size: 0,
          position3D: new Vector3(-6, 3, 0),
          metadata: {
            lastModified: new Date('2021-12-01'),
            author: 'Manav Dhindsa'
          },
          children: [
            {
              id: 'model.py',
              name: 'model.py',
              type: 'file',
              size: 5200,
              position3D: new Vector3(-8, 5, 2),
              metadata: {
                extension: 'py',
                language: 'Python',
                linesOfCode: 250,
                lastModified: new Date('2021-11-15'),
                author: 'Manav Dhindsa',
                description: 'Document classification ML model'
              }
            },
            {
              id: 'feature_extractor.py',
              name: 'feature_extractor.py',
              type: 'file',
              size: 3600,
              position3D: new Vector3(-8, 5, 4),
              metadata: {
                extension: 'py',
                language: 'Python',
                linesOfCode: 180,
                lastModified: new Date('2021-10-20'),
                author: 'Manav Dhindsa',
                description: 'Text feature extraction utilities'
              }
            }
          ]
        },
        {
          id: 'document-bundling',
          name: 'document-bundling',
          type: 'directory',
          size: 0,
          position3D: new Vector3(6, 3, 0),
          metadata: {
            lastModified: new Date('2021-08-01'),
            author: 'Manav Dhindsa'
          },
          children: [
            {
              id: 'BundleInterface.tsx',
              name: 'BundleInterface.tsx',
              type: 'file',
              size: 4200,
              position3D: new Vector3(8, 5, 2),
              metadata: {
                extension: 'tsx',
                language: 'TypeScript',
                linesOfCode: 200,
                lastModified: new Date('2021-07-30'),
                author: 'Manav Dhindsa',
                description: 'Drag and drop bundling interface'
              }
            }
          ]
        }
      ]
    }
  }

  private static generateAutifyFileTree(): FileTreeNode {
    return {
      id: 'root',
      name: 'autify-ai-testing',
      type: 'directory',
      size: 0,
      position3D: new Vector3(0, 0, 0),
      metadata: {
        lastModified: new Date('2024-12-01'),
        author: 'Manav Dhindsa'
      },
      children: [
        {
          id: 'ai-engine',
          name: 'ai-engine',
          type: 'directory',
          size: 0,
          position3D: new Vector3(-4, 2, 0),
          metadata: {
            lastModified: new Date('2024-11-15'),
            author: 'Manav Dhindsa'
          },
          children: [
            {
              id: 'analyzer.go',
              name: 'analyzer.go',
              type: 'file',
              size: 6800,
              position3D: new Vector3(-6, 4, 2),
              metadata: {
                extension: 'go',
                language: 'Go',
                linesOfCode: 320,
                lastModified: new Date('2024-11-10'),
                author: 'Manav Dhindsa',
                description: 'AI-powered test analysis engine'
              }
            }
          ]
        },
        {
          id: 'frontend',
          name: 'frontend',
          type: 'directory',
          size: 0,
          position3D: new Vector3(4, 2, 0),
          metadata: {
            lastModified: new Date('2024-11-20'),
            author: 'Manav Dhindsa'
          },
          children: [
            {
              id: 'TestDashboard.svelte',
              name: 'TestDashboard.svelte',
              type: 'file',
              size: 3400,
              position3D: new Vector3(6, 4, 2),
              metadata: {
                extension: 'svelte',
                language: 'Svelte',
                linesOfCode: 160,
                lastModified: new Date('2024-11-18'),
                author: 'Manav Dhindsa',
                description: 'Main test dashboard component'
              }
            }
          ]
        }
      ]
    }
  }

  private static generateGenericFileTree(projectId: string): FileTreeNode {
    return {
      id: 'root',
      name: projectId,
      type: 'directory',
      size: 0,
      position3D: new Vector3(0, 0, 0),
      metadata: {
        lastModified: new Date(),
        author: 'Manav Dhindsa'
      },
      children: []
    }
  }

  private static createNode(
    id: string,
    name: string,
    type: NodeType,
    size: number,
    dependencies: string[],
    color?: string
  ): CodeNode {
    return {
      id,
      name,
      type,
      size,
      dependencies,
      position3D: new Vector3(
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ),
      metadata: {
        language: this.getLanguageForNodeType(type),
        linesOfCode: Math.floor(size * 0.8),
        complexity: Math.random() * 10,
        lastModified: new Date(),
        author: 'Manav Dhindsa',
        technologies: this.getTechnologiesForNodeType(type),
        description: `${name} component`
      },
      color: color || this.getColorForNodeType(type)
    }
  }

  private static createEdge(
    source: string,
    target: string,
    type: EdgeType,
    weight: number
  ): CodeEdge {
    return {
      id: `edge-${this.edgeIdCounter++}`,
      source,
      target,
      type,
      weight,
      metadata: {
        strength: weight,
        frequency: Math.floor(weight * 100),
        description: `${type} relationship between ${source} and ${target}`
      }
    }
  }

  private static getLanguageForNodeType(type: NodeType): string {
    const languageMap: Record<NodeType, string> = {
      [NodeType.COMPONENT]: 'TypeScript',
      [NodeType.SERVICE]: 'TypeScript',
      [NodeType.API]: 'TypeScript',
      [NodeType.MODULE]: 'TypeScript',
      [NodeType.DATABASE]: 'SQL',
      [NodeType.FILE]: 'TypeScript',
      [NodeType.DIRECTORY]: '',
      [NodeType.FUNCTION]: 'TypeScript',
      [NodeType.CLASS]: 'TypeScript',
      [NodeType.LIBRARY]: 'TypeScript'
    }
    return languageMap[type] || 'TypeScript'
  }

  private static getTechnologiesForNodeType(type: NodeType): string[] {
    const techMap: Record<NodeType, string[]> = {
      [NodeType.COMPONENT]: ['React', 'TypeScript'],
      [NodeType.SERVICE]: ['Node.js', 'TypeScript'],
      [NodeType.API]: ['GraphQL', 'REST'],
      [NodeType.MODULE]: ['TypeScript'],
      [NodeType.DATABASE]: ['PostgreSQL', 'SQL'],
      [NodeType.FILE]: ['TypeScript'],
      [NodeType.DIRECTORY]: [],
      [NodeType.FUNCTION]: ['TypeScript'],
      [NodeType.CLASS]: ['TypeScript'],
      [NodeType.LIBRARY]: ['npm', 'TypeScript']
    }
    return techMap[type] || []
  }

  private static getColorForNodeType(type: NodeType): string {
    const colorMap: Record<NodeType, string> = {
      [NodeType.COMPONENT]: '#61DAFB',
      [NodeType.SERVICE]: '#3178C6',
      [NodeType.API]: '#E10098',
      [NodeType.MODULE]: '#F7DF1E',
      [NodeType.DATABASE]: '#336791',
      [NodeType.FILE]: '#4CAF50',
      [NodeType.DIRECTORY]: '#FF9800',
      [NodeType.FUNCTION]: '#9C27B0',
      [NodeType.CLASS]: '#2196F3',
      [NodeType.LIBRARY]: '#795548'
    }
    return colorMap[type] || '#607D8B'
  }
}
