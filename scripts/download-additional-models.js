/**
 * Download additional face detection models (MTCNN and TinyFace)
 * from the official face-api.js models repository
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.join(__dirname, '../app/resource/models');
const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js-models/master/';

// Model files to download
const MODEL_FILES = {
  mtcnn: [
    'mtcnn_model-shard1',
    'mtcnn_model-weights_manifest.json'
  ],
  tinyFace: [
    'tiny_face_detector_model-shard1',
    'tiny_face_detector_model-weights_manifest.json'
  ]
};

/**
 * Download a file from URL
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log(`✓ Downloaded: ${path.basename(destPath)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

/**
 * Main download function
 */
async function downloadModels() {
  console.log('Downloading additional face detection models...\n');
  
  // Ensure models directory exists
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
  
  try {
    // Download MTCNN models
    console.log('Downloading MTCNN models...');
    for (const file of MODEL_FILES.mtcnn) {
      const url = BASE_URL + 'mtcnn/' + file;
      const destPath = path.join(MODELS_DIR, file);
      await downloadFile(url, destPath);
    }
    
    // Download TinyFace models
    console.log('\nDownloading Tiny Face Detector models...');
    for (const file of MODEL_FILES.tinyFace) {
      const url = BASE_URL + 'tiny_face_detector/' + file;
      const destPath = path.join(MODELS_DIR, file);
      await downloadFile(url, destPath);
    }
    
    console.log('\n✓ All additional models downloaded successfully!');
    console.log('\nAvailable models:');
    console.log('  - SSD MobileNetV1 (default, fast)');
    console.log('  - MTCNN (better for profiles and difficult angles)');
    console.log('  - Tiny Face Detector (better for small/distant faces)');
    
  } catch (error) {
    console.error('\n✗ Error downloading models:', error.message);
    process.exit(1);
  }
}

downloadModels();
