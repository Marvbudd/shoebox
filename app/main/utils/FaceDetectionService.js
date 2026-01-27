/**
 * FaceDetectionService - Handles face detection using TensorFlow.js and face-api.js
 * 
 * This service runs in the main process and provides:
 * - Face detection in images
 * - Generation of 128-dimensional face descriptors for recognition
 * - Face matching based on descriptor similarity
 * 
 * Uses pre-trained models:
 * - ssd_mobilenetv1: Face detection
 * - faceLandmark68Net: Facial landmarks (68 points)
 * - faceRecognitionNet: Face descriptors (128-dimensional embeddings)
 */

import * as faceapi from 'face-api.js';
import canvas from 'canvas';
import path from 'path';
import fs from 'fs';

// Configure canvas for Node.js environment
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

export class FaceDetectionService {
  constructor(modelsPath) {
    this.modelsPath = modelsPath;
    this.modelsLoaded = {
      ssd: false,
      mtcnn: false,
      tinyFace: false,
      landmarks: false,
      recognition: false
    };
    this.MATCH_THRESHOLD = 0.6; // Distance threshold for face matching (lower = more similar)
    this.IOU_THRESHOLD = 0.5; // Intersection over Union threshold for deduplication
  }

  /**
   * Load all required TensorFlow models
   * Should be called once at application startup
   */
  async loadModels() {
    // Only check if required models are loaded (landmarks, recognition)
    // Optional detector models (ssd, mtcnn, tinyFace) are loaded on first call
    const requiredModelsLoaded = this.modelsLoaded.landmarks && this.modelsLoaded.recognition;
    
    if (requiredModelsLoaded) {
      return;
    }

    try {
      
      // Load all models in parallel
      const loadPromises = [];
      
      // Always load landmarks and recognition (required for all detectors)
      if (!this.modelsLoaded.landmarks) {
        loadPromises.push(
          faceapi.nets.faceLandmark68Net.loadFromDisk(this.modelsPath)
            .then(() => { this.modelsLoaded.landmarks = true; })
        );
      }
      
      if (!this.modelsLoaded.recognition) {
        loadPromises.push(
          faceapi.nets.faceRecognitionNet.loadFromDisk(this.modelsPath)
            .then(() => { this.modelsLoaded.recognition = true; })
        );
      }
      
      // Load SSD MobileNetV1 (default, always available)
      if (!this.modelsLoaded.ssd) {
        loadPromises.push(
          faceapi.nets.ssdMobilenetv1.loadFromDisk(this.modelsPath)
            .then(() => { this.modelsLoaded.ssd = true; })
        );
      }
      
      // Load MTCNN if models exist (better for profiles, difficult angles)
      const mtcnnPath = path.join(this.modelsPath, 'mtcnn_model-weights_manifest.json');
      if (!this.modelsLoaded.mtcnn && fs.existsSync(mtcnnPath)) {
        loadPromises.push(
          faceapi.nets.mtcnn.loadFromDisk(this.modelsPath)
            .then(() => { 
              this.modelsLoaded.mtcnn = true;
              console.log('MTCNN model loaded');
            })
            .catch(err => {
              console.warn('MTCNN model not available:', err.message);
            })
        );
      }
      
      // Load TinyFace if models exist (better for small/distant faces)
      const tinyFacePath = path.join(this.modelsPath, 'tiny_face_detector_model-weights_manifest.json');
      if (!this.modelsLoaded.tinyFace && fs.existsSync(tinyFacePath)) {
        loadPromises.push(
          faceapi.nets.tinyFaceDetector.loadFromDisk(this.modelsPath)
            .then(() => { 
              this.modelsLoaded.tinyFace = true;
              console.log('TinyFace model loaded');
            })
            .catch(err => {
              console.warn('TinyFace model not available:', err.message);
            })
        );
      }

      await Promise.all(loadPromises);
      console.log('Face detection models loaded successfully:', this.modelsLoaded);
    } catch (error) {
      console.error('Error loading face detection models:', error);
      throw new Error(`Failed to load face detection models: ${error.message}`);
    }
  }

  /**
   * Detect faces in an image file and extract face descriptors
   * @param {string} imagePath - Absolute path to the image file
   * @param {Array<string>} models - Models to use: ['ssd', 'mtcnn', 'tinyFace'] (default: ['ssd'])
   * @param {number} minConfidence - Minimum confidence threshold (0.0-1.0, default: 0.5)
   * @returns {Promise<Array>} Array of detected faces with descriptors and regions
   */
  async detectFaces(imagePath, models = ['ssd'], minConfidence = 0.5) {
    if (!this.modelsLoaded.landmarks || !this.modelsLoaded.recognition) {
      throw new Error('Face detection models not loaded. Call loadModels() first.');
    }

    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    try {
      // Load image from disk
      const img = await canvas.loadImage(imagePath);
      
      // Run detection with each requested model
      const allDetections = [];
      
      for (const modelName of models) {
        const detections = await this._detectWithModel(img, modelName, minConfidence);
        if (detections && detections.length > 0) {
          allDetections.push(...detections.map(d => ({ ...d, model: modelName })));
        }
      }
      
      if (allDetections.length === 0) {
        return [];
      }

      // Deduplicate overlapping faces if using multiple models
      const faces = models.length > 1 
        ? this._deduplicateFaces(allDetections, img.width, img.height)
        : this._convertToNormalizedFormat(allDetections, img.width, img.height);

      return faces;

    } catch (error) {
      console.error('Error detecting faces:', error);
      throw new Error(`Face detection failed: ${error.message}`);
    }
  }

  /**
   * Detect faces using a specific model
   * @private
   */
  async _detectWithModel(img, modelName, minConfidence) {
    let detectionPromise;
    
    switch (modelName) {
      case 'ssd':
        if (!this.modelsLoaded.ssd) {
          console.warn('SSD model not loaded, skipping');
          return [];
        }
        detectionPromise = faceapi
          .detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence }))
          .withFaceLandmarks()
          .withFaceDescriptors();
        break;
        
      case 'mtcnn':
        if (!this.modelsLoaded.mtcnn) {
          console.warn('MTCNN model not loaded, skipping');
          return [];
        }
        detectionPromise = faceapi
          .detectAllFaces(img, new faceapi.MtcnnOptions({ minConfidence }))
          .withFaceLandmarks()
          .withFaceDescriptors();
        break;
        
      case 'tinyFace':
        if (!this.modelsLoaded.tinyFace) {
          console.warn('TinyFace model not loaded, skipping');
          return [];
        }
        // TinyFaceDetector uses scoreThreshold instead of minConfidence
        detectionPromise = faceapi
          .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: minConfidence }))
          .withFaceLandmarks()
          .withFaceDescriptors();
        break;
        
      default:
        console.warn(`Unknown model: ${modelName}`);
        return [];
    }
    
    return await detectionPromise;
  }

  /**
   * Convert detection results to normalized format
   * @private
   */
  _convertToNormalizedFormat(detections, imgWidth, imgHeight) {
    return detections.map((detection, index) => {
      const box = detection.detection.box;

      // Convert to MWG Regions format (normalized coordinates)
      const region = {
        x: (box.x + box.width / 2) / imgWidth,
        y: (box.y + box.height / 2) / imgHeight,
        w: box.width / imgWidth,
        h: box.height / imgHeight
      };

      return {
        index,
        descriptor: Array.from(detection.descriptor),
        region,
        confidence: detection.detection.score,
        landmarks: detection.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
        model: detection.model || 'ssd'
      };
    });
  }

  /**
   * Deduplicate overlapping faces from multiple models
   * Keeps the detection with highest confidence when faces overlap significantly
   * @private
   */
  _deduplicateFaces(detections, imgWidth, imgHeight) {
    const converted = this._convertToNormalizedFormat(detections, imgWidth, imgHeight);
    const keep = [];
    
    for (let i = 0; i < converted.length; i++) {
      let isDuplicate = false;
      
      for (let j = 0; j < keep.length; j++) {
        const iou = this._calculateIOU(converted[i].region, keep[j].region);
        
        if (iou > this.IOU_THRESHOLD) {
          // Faces overlap significantly
          isDuplicate = true;
          
          // Keep the one with higher confidence
          if (converted[i].confidence > keep[j].confidence) {
            keep[j] = converted[i];
          }
          break;
        }
      }
      
      if (!isDuplicate) {
        keep.push(converted[i]);
      }
    }
    
    // Re-index after deduplication
    return keep.map((face, index) => ({ ...face, index }));
  }

  /**
   * Calculate Intersection over Union for two face regions
   * @private
   */
  _calculateIOU(region1, region2) {
    // Convert center/size to corners
    const box1 = {
      x1: region1.x - region1.w / 2,
      y1: region1.y - region1.h / 2,
      x2: region1.x + region1.w / 2,
      y2: region1.y + region1.h / 2
    };
    
    const box2 = {
      x1: region2.x - region2.w / 2,
      y1: region2.y - region2.h / 2,
      x2: region2.x + region2.w / 2,
      y2: region2.y + region2.h / 2
    };
    
    // Calculate intersection
    const x1 = Math.max(box1.x1, box2.x1);
    const y1 = Math.max(box1.y1, box2.y1);
    const x2 = Math.min(box1.x2, box2.x2);
    const y2 = Math.min(box1.y2, box2.y2);
    
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    
    // Calculate union
    const area1 = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
    const area2 = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
    const union = area1 + area2 - intersection;
    
    return intersection / union;
  }

  /**
   * Calculate Euclidean distance between two face descriptors
   * @param {Array} descriptor1 - 128-dimensional descriptor
   * @param {Array} descriptor2 - 128-dimensional descriptor
   * @returns {number} Distance (0 = identical, higher = more different)
   */
  euclideanDistance(descriptor1, descriptor2) {
    if (!descriptor1 || !descriptor2 || 
        descriptor1.length !== 128 || descriptor2.length !== 128) {
      throw new Error('Invalid face descriptors for comparison');
    }

    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const diff = descriptor1[i] - descriptor2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Match a face descriptor against a collection of known descriptors
   * @param {Array} faceDescriptor - The descriptor to match
   * @param {Object} knownDescriptors - Map of personKey -> descriptor arrays
   * @returns {Object|null} Best match with personKey and confidence, or null if no match
   */
  matchFace(faceDescriptor, knownDescriptors) {
    let bestMatch = null;
    let bestDistance = Infinity;

    for (const [personKey, descriptors] of Object.entries(knownDescriptors)) {
      // descriptors can be a single descriptor or an object with multiple descriptors
      const descriptorArray = Array.isArray(descriptors) 
        ? [descriptors] 
        : Object.values(descriptors);

      for (const descriptor of descriptorArray) {
        if (!descriptor || !Array.isArray(descriptor)) continue;
        
        const distance = this.euclideanDistance(faceDescriptor, descriptor);
        
        if (distance < bestDistance && distance < this.MATCH_THRESHOLD) {
          bestDistance = distance;
          bestMatch = personKey;
        }
      }
    }

    if (bestMatch) {
      return {
        personKey: bestMatch,
        distance: bestDistance,
        confidence: 1 - bestDistance // Convert distance to confidence (higher = better)
      };
    }

    return null;
  }

  /**
   * Get list of available detection models
   * @returns {Array} Array of model objects with name, key, and availability
   */
  getAvailableModels() {
    return [
      {
        key: 'ssd',
        name: 'SSD MobileNetV1',
        description: 'Fast, general purpose (default)',
        available: this.modelsLoaded.ssd
      },
      {
        key: 'mtcnn',
        name: 'MTCNN',
        description: 'Better for profiles and difficult angles',
        available: this.modelsLoaded.mtcnn
      },
      {
        key: 'tinyFace',
        name: 'Tiny Face Detector',
        description: 'Better for small/distant faces',
        available: this.modelsLoaded.tinyFace
      }
    ];
  }

  /**
   * Get current model status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      modelsLoaded: this.modelsLoaded,
      modelsPath: this.modelsPath,
      matchThreshold: this.MATCH_THRESHOLD
    };
  }

  /**
   * Update the match threshold
   * @param {number} threshold - New threshold (0-1, lower = stricter matching)
   */
  setMatchThreshold(threshold) {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Match threshold must be between 0 and 1');
    }
    this.MATCH_THRESHOLD = threshold;
    console.log('Face match threshold updated to:', threshold);
  }
}
