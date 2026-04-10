import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Shoebox',
  description: 'Personal Family History Archive Manager',
  base: '/shoebox/',
  
  themeConfig: {
    logo: '/logo.png',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/overview' },
      { text: 'GitHub', link: 'https://github.com/Marvbudd/shoebox' }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'First Launch', link: '/guide/first-launch' },
            { text: 'Creating Your Archive', link: '/guide/creating-archive' }
          ]
        },
        {
          text: 'Core Concepts',
          items: [
            { text: 'Archives vs Collections', link: '/guide/archives-vs-collections' },
            { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' }
          ]
        },
        {
          text: 'Advanced & Development',
          items: [
            { text: 'Managing Multiple Archives', link: '/guide/managing-multiple-archives' },
            { text: 'Data Structure Reference', link: '/guide/data-structure' },
            { text: 'Architecture Reference', link: '/guide/architecture' }
          ]
        }
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Overview', link: '/features/overview' },
            { text: 'Slideshow Mode', link: '/features/slideshow' },
            { text: 'Face Detection', link: '/features/face-detection' },
            { text: 'Collections', link: '/features/collections' },
            { text: 'Metadata', link: '/features/metadata' }
          ]
        },
        {
          text: 'Advanced & Technical',
          items: [
            { text: 'Advanced Face Detection', link: '/features/face-detection-advanced' },
            { text: 'Collection Set Operations Implementation', link: '/features/collection-set-operations' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Marvbudd/shoebox' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2001-2026 Marvin E Budd'
    },

    search: {
      provider: 'local'
    }
  }
})
