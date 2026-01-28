import { createApp } from 'vue';
import MediaManager from './MediaManager.vue';

const app = createApp(MediaManager);

// Global error handler to catch and log errors instead of blanking the screen
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err);
  console.error('Component:', instance);
  console.error('Error info:', info);
  // Don't rethrow - this prevents the app from crashing
};

app.mount('#app');
