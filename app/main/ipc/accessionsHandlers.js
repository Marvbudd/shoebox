/**
 * Accessions creation and media-related IPC handlers
 * 
 * Handles:
 * - Directory selection
 * - Creating new accessions
 * - Media path resolution
 * - Archive validation
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import canvas from 'canvas';
import { AccessionClass } from '../../main/utils/AccessionClass.js';
import { validateMediaDirectory } from '../utils/helpers.js';
import { FACE_OVERLAY_STYLE } from '../../render/vue/shared/faceOverlayEngine.js';

/**
 * Register accessions and media IPC handlers
 * 
 * @param {Electron.IpcMain} ipcMain - The Electron IPC main instance
 * @param {Electron.Dialog} dialog - The Electron dialog module
 * @param {Function} getAccessionClass - Function that returns the current AccessionClass instance
 * @param {Function} setAccessionClass - Function to set the AccessionClass instance
 * @param {Function} verifyAccessions - Function to ensure AccessionClass is initialized
 * @param {Function} resetAccessions - Function to reload accessions
 * @param {Function} getCreateAccessionsWindow - Function that returns create accessions window
 * @param {Object} nconf - Configuration object
 * @param {Electron.Shell} shell - The Electron shell module
 */
export function registerAccessionsHandlers(
  ipcMain,
  dialog,
  getAccessionClass,
  setAccessionClass,
  verifyAccessions,
  resetAccessions,
  getCreateAccessionsWindow,
  nconf,
  shell
) {

  // Get current archive info for auto-filling
  ipcMain.handle('accessions:getCurrentArchiveInfo', async () => {
    try {
      const accessionClass = getAccessionClass();
      const accessionsPath = nconf.get('db:accessionsPath');
      
      if (accessionClass && accessionsPath) {
        return {
          directory: path.dirname(accessionsPath),
          title: accessionClass.getTitle()
        };
      }
      
      return { directory: '', title: '' };
    } catch (error) {
      console.error('Error getting current archive info:', error);
      return { directory: '', title: '' };
    }
  });

  // Directory selection dialog
  ipcMain.handle('directory:select', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    
    if (result.canceled) {
      return { canceled: true };
    }
    
    return { 
      canceled: false, 
      filePath: result.filePaths[0] 
    };
  });

  // Create new accessions
  ipcMain.handle('accessions:create', async (_event, formData) => {
    try {
      // Save existing accessions if any
      let accessionClass = getAccessionClass();
      if (accessionClass) {
        accessionClass.saveAccessions();
        setAccessionClass(undefined);
      }

      const validation = validateMediaDirectory(formData.directory);
      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Set new accessions path
      const accessionsPath = path.resolve(formData.directory, "accessions.json");
      nconf.set('db:accessionsPath', accessionsPath);
      nconf.save('user');

      // Create new AccessionClass with title
      accessionClass = new AccessionClass(accessionsPath, formData.title);
      setAccessionClass(accessionClass);

      // Handle source person if provided
      let sourcePersonID = null;
      if (formData.sourceMode === 'existing' && formData.sourcePersonID) {
        // Use existing person
        sourcePersonID = formData.sourcePersonID;
      } else if (formData.sourceMode === 'new' && (formData.sourceFirstName || formData.sourceLastName)) {
        // Create new person
        sourcePersonID = crypto.randomUUID();
        
        const newPerson = {
          personID: sourcePersonID,
          TMGID: formData.sourceTMGID ? parseInt(formData.sourceTMGID) : null,
          first: formData.sourceFirstName || '',
          last: formData.sourceLastName ? [{ last: formData.sourceLastName }] : []
        };
        
        // Add person to accessions using encapsulated method
        accessionClass.savePerson(newPerson);
      }

      // Build form data in the format expected by addMediaFiles
      const mediaFormData = {
        selectQuery: 'directory',
        title: formData.title,
        updateFocus: formData.directory,
        description: formData.description || '',
        dateYear: formData.dateYear || '',
        dateMonth: formData.dateMonth || '',
        dateDay: formData.dateDay || '',
        dateTime: formData.dateTime || '',
        locationDetail: formData.locationDetail || '',
        locationCity: formData.locationCity || '',
        locationState: formData.locationState || ''
      };

      // Add source information if provided
      if (sourcePersonID) {
        mediaFormData.sourcePersonID = sourcePersonID;
        // Use the properly formatted date object
        if (formData.dateReceivedParsed) {
          mediaFormData.dateReceived = formData.dateReceivedParsed;
        }
      }

      // Add media files
      await accessionClass.addMediaFiles(mediaFormData);

      // Save the accessions
      accessionClass.saveAccessions();

      // Get item count
      const itemCount = accessionClass.accessionJSON.accessions?.item?.length || 0;

      // Close window first, then reset (avoid race condition during window destruction)
      const createAccessionsWindow = getCreateAccessionsWindow();
      if (createAccessionsWindow && !createAccessionsWindow.isDestroyed()) {
        createAccessionsWindow.close();
        // Wait for window to fully close before resetting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Now safe to reset and send IPC messages
      resetAccessions();

      return { success: true, itemsAdded: itemCount };
    } catch (error) {
      console.error('Failed to create accessions:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Get media file path
  // Returns base64 data URL for photos (small, need to be loaded completely)
  // Returns custom protocol URL for audio/video (large, need streaming)
  ipcMain.handle('media:getPath', async (_event, type, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const baseDir = path.dirname(accessionClass.accessionFilename);
      const resourcePath = path.resolve(baseDir, type, link);
      
     // For photos, use base64 encoding (better for small images in sandboxed renderer)
      if (type === 'photo') {
        const data = fs.readFileSync(resourcePath);
        const encoded = data.toString('base64');
        return `data:image/jpg;base64,${encoded}`;
      }
      
      // For audio/video, use custom protocol (supports streaming, no size limits)
      // Format: media://type/filename
      return `media://${type}/${link}`;
      
    } catch (error) {
      console.error('Failed to get media path:', error);
      return null;
    }
  });

  // Open file in system default viewer
  ipcMain.handle('file:open', async (_event, filePath) => {
    try {
      // Remove file:// prefix if present
      const cleanPath = filePath.replace(/^file:\/\//, '');
      
      // shell.openPath returns "" on success, or error message string on failure
      const result = await shell.openPath(cleanPath);
      
      if (result) {
        // Non-empty string means error
        console.error('Failed to open file:', result);
        return { success: false, error: result };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to open file:', error);
      return { success: false, error: error.message };
    }
  });

  // Open media file by type and link
  ipcMain.handle('media:openExternal', async (_event, type, link) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const baseDir = path.dirname(accessionClass.accessionFilename);
      const fullPath = path.resolve(baseDir, type, link);
      
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: 'File not found: ' + fullPath };
      }

      // shell.openPath returns "" on success, or error message string on failure
      const result = await shell.openPath(fullPath);
      
      if (result) {
        // Non-empty string means error
        console.error('Failed to open media file:', result);
        return { success: false, error: result };
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to open media file:', error);
      return { success: false, error: error.message };
    }
  });

  // Open a static photo + face-tag snapshot image via the OS default image viewer.
  ipcMain.handle('media:openSnapshotExternal', async (_event, payload = {}) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const type = payload.type;
      const link = payload.link;
      const overlaySnapshot = payload.overlaySnapshot || null;

      if (type !== 'photo' || !link) {
        return { success: false, error: 'Snapshot export requires a photo link' };
      }

      const baseDir = path.dirname(accessionClass.accessionFilename);
      const fullPath = path.resolve(baseDir, type, link);
      if (!fs.existsSync(fullPath)) {
        return { success: false, error: `Photo not found: ${fullPath}` };
      }
      const sourceImage = await canvas.loadImage(fullPath);
      if (!sourceImage || !sourceImage.width || !sourceImage.height) {
        return { success: false, error: 'Unable to decode source photo for snapshot' };
      }

      const renderCanvas = canvas.createCanvas(sourceImage.width, sourceImage.height);
      const ctx = renderCanvas.getContext('2d');
      ctx.drawImage(sourceImage, 0, 0, sourceImage.width, sourceImage.height);

      const mode = overlaySnapshot?.mode || 'off';
      const faces = Array.isArray(overlaySnapshot?.faces) ? overlaySnapshot.faces : [];

      if (mode !== 'off') {
        ctx.textBaseline = 'alphabetic';
        for (let index = 0; index < faces.length; index++) {
          const face = faces[index];
          const region = face?.region;
          if (!region) continue;

          const w = Number(region.w || 0) * sourceImage.width;
          const h = Number(region.h || 0) * sourceImage.height;
          const x = Number(region.x || 0) * sourceImage.width - (w / 2);
          const y = Number(region.y || 0) * sourceImage.height - (h / 2);

          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
            continue;
          }

          ctx.strokeStyle = '#ff6600';
          ctx.lineWidth = FACE_OVERLAY_STYLE.borderWidth;
          ctx.strokeRect(x, y, w, h);

          const numberText = face?.numberText || String(index + 1);
          ctx.font = FACE_OVERLAY_STYLE.numberFont;
          const numberWidth = ctx.measureText(numberText).width;
          const numberHeight = FACE_OVERLAY_STYLE.numberBoxHeight;
          ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
          ctx.fillRect(x + 2, y + 2, numberWidth + 10, numberHeight);
          ctx.fillStyle = '#ff6600';
          ctx.fillText(numberText, x + 6, y + FACE_OVERLAY_STYLE.numberTextYOffset);

          const label = String(face?.label || '').trim();
          if (label.length === 0) {
            continue;
          }

          ctx.font = FACE_OVERLAY_STYLE.labelFont;
          const labelWidth = Math.ceil(ctx.measureText(label).width) + 12;
          const labelHeight = FACE_OVERLAY_STYLE.labelBoxHeight;
          const labelX = Math.max(0, Math.min(sourceImage.width - labelWidth, x + 2));
          const labelYAbove = y - (labelHeight + 6);
          const labelY = labelYAbove < 0
            ? Math.min(sourceImage.height - labelHeight, y + h + 6)
            : labelYAbove;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
          ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(label, labelX + 5, labelY + FACE_OVERLAY_STYLE.labelTextYOffset);
        }
      }

      const safeStem = String(link)
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'snapshot';

      const fileName = `shoebox-snapshot-${safeStem}-${Date.now()}-${crypto.randomUUID()}.png`;
      const cacheRoot = process.env.XDG_CACHE_HOME
        ? path.resolve(process.env.XDG_CACHE_HOME)
        : path.join(os.homedir(), '.cache');
      const snapshotDir = path.join(cacheRoot, 'shoebox', 'snapshots');

      let outFile;
      try {
        fs.mkdirSync(snapshotDir, { recursive: true });
        outFile = path.join(snapshotDir, fileName);
      } catch (_mkdirError) {
        outFile = path.join(os.tmpdir(), fileName);
      }

      fs.writeFileSync(outFile, renderCanvas.toBuffer('image/png'));

      const openResult = await shell.openPath(outFile);
      if (openResult) {
        console.error('Failed to open snapshot image file:', openResult);
        return { success: false, error: openResult };
      }

      return { success: true, filePath: outFile };
    } catch (error) {
      console.error('Failed to open external snapshot:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Open a renderer-generated static snapshot image (PNG/JPEG/WebP) via the OS default app.
  ipcMain.handle('media:openSnapshotImageExternal', async (_event, payload = {}) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      const dataUrl = payload?.dataUrl;
      const linkHint = String(payload?.link || 'snapshot');

      if (!dataUrl || typeof dataUrl !== 'string') {
        return { success: false, error: 'Missing snapshot image data' };
      }

      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        return { success: false, error: 'Invalid snapshot image format' };
      }

      const mimeType = String(match[1] || '').toLowerCase();
      const base64Data = match[2] || '';
      let extension = 'png';
      if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        extension = 'jpg';
      } else if (mimeType === 'image/webp') {
        extension = 'webp';
      }

      const imageBuffer = Buffer.from(base64Data, 'base64');
      if (!imageBuffer || imageBuffer.length === 0) {
        return { success: false, error: 'Snapshot image is empty' };
      }

      const safeStem = linkHint
        .replace(/[^a-zA-Z0-9._-]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80) || 'snapshot';

      const fileName = `shoebox-snapshot-${safeStem}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const cacheRoot = process.env.XDG_CACHE_HOME
        ? path.resolve(process.env.XDG_CACHE_HOME)
        : path.join(os.homedir(), '.cache');
      const snapshotDir = path.join(cacheRoot, 'shoebox', 'snapshots');

      let outFile;
      try {
        fs.mkdirSync(snapshotDir, { recursive: true });
        outFile = path.join(snapshotDir, fileName);
      } catch (_mkdirError) {
        outFile = path.join(os.tmpdir(), fileName);
      }

      fs.writeFileSync(outFile, imageBuffer);

      const openResult = await shell.openPath(outFile);
      if (openResult) {
        console.error('Failed to open snapshot image file:', openResult);
        return { success: false, error: openResult };
      }

      return { success: true, filePath: outFile };
    } catch (error) {
      console.error('Failed to open generated snapshot image:', error);
      return { success: false, error: error.message || String(error) };
    }
  });

  // Validate archive
  ipcMain.handle('accessions:validate', async (_event) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      // Use AccessionClass method (properly encapsulated)
      const result = await accessionClass.validateArchive();
      
      return { 
        success: true, 
        ...result
      };
    } catch (error) {
      console.error('Failed to validate archive:', error);
      return { 
        success: false, 
        error: error.message || String(error) 
      };
    }
  });

  // Get audio and video items for playlist dropdown
  ipcMain.handle('accessions:getAudioVideoItems', async (_event) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      if (!accessionClass.accessionJSON?.accessions?.item) {
        return [];
      }
      
      // Filter for audio and video items only
      const audioVideoItems = accessionClass.accessionJSON.accessions.item
        .filter(item => item.type === 'audio' || item.type === 'video')
        .map(item => ({
          accession: item.accession,
          link: item.link,
          type: item.type,
          description: item.description || ''
        }))
        .sort((a, b) => {
          // Sort by type first (audio before video), then by link
          if (a.type !== b.type) {
            return a.type === 'audio' ? -1 : 1;
          }
          return (a.link || '').localeCompare(b.link || '');
        });
      
      return audioVideoItems;
    } catch (error) {
      console.error('Failed to get audio/video items:', error);
      return [];
    }
  });

  // Get all archive item links (for collection operations preview)
  ipcMain.handle('accessions:getAllItemLinks', async (_event) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      if (!accessionClass.accessionJSON?.accessions?.item) {
        return [];
      }
      
      // Return just the links for efficient comparison
      return accessionClass.accessionJSON.accessions.item.map(item => item.link);
    } catch (error) {
      console.error('Failed to get all item links:', error);
      return [];
    }
  });

  // Reverse geocoding using Nominatim API
  ipcMain.handle('geocoding:reverse', async (event, latitude, longitude) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ShoeboxApp/2.2 (Genealogy Application)'
        }
      });

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.address) {
        // Try multiple fields for city/locality (varies by country and region)
        const city = data.address.city || 
                     data.address.town || 
                     data.address.village || 
                     data.address.municipality ||
                     data.address.county ||
                     data.address.district ||
                     data.address.locality ||
                     '';
        const state = data.address.state || data.address.region || '';
        
        return {
          success: true,
          city,
          state,
          fullAddress: data.display_name
        };
      } else {
        return {
          success: false,
          error: 'No address found for these coordinates'
        };
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  });

  // Import full archive (persons + items)
  ipcMain.handle('archive:import', async (_event, sourceFilePath, options = {}) => {
    try {
      verifyAccessions();
      const accessionClass = getAccessionClass();
      
      // Read source file
      const fs = await import('fs');
      const sourceContent = await fs.promises.readFile(sourceFilePath, 'utf8');
      const sourceData = JSON.parse(sourceContent);
      
      // Validate source has required structure
      if (!sourceData.persons || !sourceData.accessions) {
        return {
          success: false,
          error: 'Source file does not contain valid archive structure (missing persons or accessions)'
        };
      }
      
      // Import using AccessionClass method (properly encapsulated)
      const result = await accessionClass.importArchive(sourceData, sourceFilePath, options);
      
      return {
        success: true,
        results: result.results,
        logContent: result.logContent
      };
      
    } catch (error) {
      console.error('Archive import error:', error);
      return {
        success: false,
        error: error.message || String(error)
      };
    }
  });
}