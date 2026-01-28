import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get window name from environment variable (default to personManager)
const windowName = process.env.VUE_WINDOW || 'personManager';

// Map window names to their source paths
const windowPaths = {
  personManager: 'app/render/vue/windows/PersonManager/index.html',
  createAccessions: 'app/render/vue/windows/CreateAccessions/index.html',
  mediaManager: 'app/render/vue/windows/MediaManager/index.html',
  updateCollection: 'app/render/vue/windows/UpdateCollection/index.html',
  collectionManager: 'app/render/vue/windows/CollectionManager/index.html',
  collectionSetOperations: 'app/render/vue/windows/CollectionSetOperations/index.html',
  mainWindow: 'app/render/vue/windows/MainWindow/index.html',
  mediaPlayer: 'app/render/vue/windows/MediaPlayer/index.html'
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  
  // Important: Use relative base for Electron
  base: './',
  
  // Build configuration for Vue windows
  build: {
    outDir: `app/render/vue-dist/${windowName}`,
    emptyOutDir: false,
    rollupOptions: {
      input: path.resolve(__dirname, windowPaths[windowName])
    }
  },
  
  // Development server
  server: {
    port: 5173
  },
  
  // Resolve aliases for cleaner imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/render/vue'),
      '@components': path.resolve(__dirname, 'app/render/vue/components'),
      '@windows': path.resolve(__dirname, 'app/render/vue/windows')
    }
  }
});
