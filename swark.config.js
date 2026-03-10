module.exports = {
  // Project metadata
  project: {
    name: 'Forma',
    description: 'Construction Management Platform',
    version: '1.0.0',
    repository: 'https://github.com/innovationwizard/forma'
  },

  // Diagram generation settings
  diagrams: {
    outputDir: './docs/architecture',
    format: 'mermaid',
    includeCodeBlocks: true,
    autoUpdate: true
  },

  // Architecture analysis rules
  analysis: {
    // Component detection patterns
    components: {
      patterns: [
        'src/components/**/*.tsx',
        'src/app/**/*.tsx',
        'src/lib/**/*.ts'
      ],
      exclude: [
        '**/*.test.tsx',
        '**/*.spec.tsx',
        '**/node_modules/**'
      ]
    },

    // API endpoint detection
    api: {
      patterns: [
        'src/app/api/**/*.ts'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    },

    // Database schema analysis
    database: {
      schemaFile: 'prisma/schema.prisma',
      generateERD: true,
      includeRelationships: true
    },

    // Dependencies analysis
    dependencies: {
      packageJson: 'package.json',
      includeDevDependencies: false,
      generateGraph: true
    }
  },

  // Custom diagram templates
  templates: {
    systemOverview: {
      title: 'System Architecture Overview',
      type: 'graph',
      layout: 'TB',
      include: ['frontend', 'backend', 'database', 'infrastructure']
    },

    componentHierarchy: {
      title: 'Component Hierarchy',
      type: 'graph',
      layout: 'TD',
      groupBy: 'feature'
    },

    dataFlow: {
      title: 'Data Flow Diagram',
      type: 'sequence',
      include: ['user', 'frontend', 'api', 'database', 'external']
    },

    security: {
      title: 'Security Architecture',
      type: 'graph',
      layout: 'TB',
      focus: ['authentication', 'authorization', 'data-protection']
    }
  },

  // Custom rules for Forma
  rules: {
    // Construction-specific terminology
    terminology: {
      'People': 'Workers/Users',
      'Companies': 'Construction Companies',
      'Projects': 'Construction Projects',
      'WorkLogs': 'Time Tracking',
      'Materials': 'Construction Materials',
      'Tasks': 'Construction Tasks'
    },

    // Business logic grouping
    businessGroups: {
      'Project Management': ['Projects', 'ProjectTeams', 'ProjectMaterials'],
      'Human Resources': ['People', 'PersonTenants', 'PersonTeams', 'PersonProjects'],
      'Time Tracking': ['WorkLogs', 'LocationUpdates', 'ClockInCard'],
      'Inventory': ['Materials', 'MaterialConsumptions', 'InventoryMovements'],
      'Task Management': ['Tasks', 'TaskAssignments', 'TaskProgressUpdates']
    },

    // Technology stack mapping
    techStack: {
      'Frontend': ['Next.js', 'React', 'TypeScript', 'Tailwind CSS'],
      'Backend': ['Node.js', 'Prisma', 'PostgreSQL'],
      'Authentication': ['NextAuth.js', 'JWT', 'bcryptjs'],
      'Infrastructure': ['Supabase PostgreSQL', 'Supabase Storage', 'Vercel'],
      'Development': ['ESLint', 'Prettier', 'Prisma Studio']
    }
  },

  // Output customization
  output: {
    // File naming conventions
    naming: {
      systemArchitecture: 'system-architecture.md',
      componentDependencies: 'component-dependencies.md',
      apiDocumentation: 'api-documentation.md',
      infrastructure: 'infrastructure.md',
      databaseSchema: 'database-schema.md',
      securityArchitecture: 'security-architecture.md'
    },

    // Mermaid diagram settings
    mermaid: {
      theme: 'default',
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true
      },
      sequence: {
        showSequenceNumbers: true,
        actorMargin: 50
      },
      er: {
        layoutDirection: 'TB',
        minEntityWidth: 100,
        minEntityHeight: 75
      }
    },

    // Markdown formatting
    markdown: {
      includeTableOfContents: true,
      includeLastUpdated: true,
      includeGitInfo: true,
      codeBlockLanguage: 'typescript'
    }
  },

  // Integration settings
  integrations: {
    // GitHub integration
    github: {
      enabled: true,
      autoCommit: true,
      commitMessage: '🤖 Auto-update architecture diagrams',
      branch: 'main'
    },

    // CI/CD integration
    ci: {
      enabled: true,
      workflowFile: '.github/workflows/architecture-diagrams.yml',
      triggerOnPush: true,
      triggerOnPR: true
    },

    // Documentation platforms
    docs: {
      readme: {
        includeArchitectureSection: true,
        autoUpdate: true
      },
      wiki: {
        enabled: false,
        autoSync: false
      }
    }
  },

  // Custom hooks for diagram generation
  hooks: {
    beforeGeneration: async (config) => {
      console.log('🚀 Starting architecture diagram generation...');
      return config;
    },

    afterGeneration: async (files) => {
      console.log(`✅ Generated ${files.length} architecture files`);
      return files;
    },

    onError: async (error) => {
      console.error('❌ Error generating architecture diagrams:', error);
      throw error;
    }
  }
};
