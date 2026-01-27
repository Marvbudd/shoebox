# Face Detection

## Overview

Shoebox includes AI-powered face detection to help you identify and tag people in your photos.

## Face Detection Models

Shoebox supports three face detection models. The default model (SSD MobileNet v1) is included with the application. Additional models can be downloaded separately if needed for specific use cases. 

### SSD MobileNet v1 (Default - Included)
- **Included with Shoebox** - no additional download needed
- Fast and accurate for most photos
- Good balance of speed and accuracy
- Recommended for typical family photos with frontal faces
- ~5.4 MB (already included in installation)

### MTCNN (Optional - Download Separately)
- Better for profiles and difficult angles
- Excels at detecting faces that aren't looking at the camera
- More thorough detection in challenging lighting
- Slower processing than SSD
- ~1.9 MB download

### Tiny Face Detector (Optional - Download Separately)
- Best for distant or small faces
- Faster than MTCNN, lighter weight
- Good for group photos where people are far from camera
- ~189 KB download

::: tip When to Download Additional Models
Most users will find the included SSD model sufficient. Download additional models only if:
- You have many profile shots or difficult angles (use MTCNN)
- You have group photos with distant faces (use Tiny Face Detector)
- The default SSD model consistently misses faces in your collection
:::

::: danger Model Mixing Warning
**Important**: Using different detection models within the same archive can produce inconsistent face descriptors. Choose one model and use it consistently throughout your archive for best results.
:::

## Auto-Matching and Suggestions

Shoebox uses a **two‑stage workflow** when you run face detection. Stage 1 **auto‑assigns** faces that were previously tagged in the same photo. Stage 2 **suggests** matches from your Person Library by selecting faces, but does not assign them until you confirm.

**How it works:**
1. When you click "Detect Faces", the system identifies all faces in the photo.
2. **Stage 1 – Same Photo Re‑matching (strict):**
   - Faces are compared only to people already in **this** photo.
   - Uses saved face data for that exact image.
   - Matches are **auto‑assigned** immediately (high confidence, strict threshold).
3. **Stage 2 – Person Library Suggestions (configurable):**
   - Remaining faces are compared against your entire Person Library.
   - Matches above your **Auto‑Assign Threshold** are **selected** (not assigned).
   - This lets you review suggestions before committing.
4. You can **Assign selected faces** with one click or adjust individual selections first.

**Benefits:**
- Preserves previously‑tagged faces with high confidence (Stage 1).
- Provides fast suggestions without forcing auto‑assignments (Stage 2).
- Lets you handle clean datasets quickly while still reviewing ambiguous cases.

**Customization:**
- Adjust the **Auto‑Assign Threshold** in Advanced Settings (applies to Stage 2 suggestions)
- Higher threshold (e.g., 0.70): Fewer suggestions, more manual review
- Lower threshold (e.g., 0.50): More suggestions, higher chance of errors
- Threshold settings are saved and persist across sessions

## Face Detection Workflow

Face detection and tagging follows a specific workflow. Understanding this process will help you efficiently tag faces across your archive.

### Step 1: Open Media Manager

1. Select a photo in the main window
2. Click **Edit Media** button or press **E**
3. Media Manager window opens with your photo

### Step 2: Detect Faces with Auto‑Matching and Suggestions

1. Click **Detect Faces** button
2. Wait for detection to complete (a few seconds)
3. Green rectangles appear around detected faces (numbered left-to-right)
4. **Two-stage workflow runs automatically:**
   - **Stage 1:** Faces already tagged in this photo are re‑matched and auto‑assigned
   - **Stage 2:** Library matches are **selected** (not assigned) for your review
5. Face badges show below the photo in left‑to‑right order

::: tip Adjusting Detection and Suggestions
Click **▶ Advanced Settings** to:
- Change detection model (SSD, MTCNN, Tiny Face)
- Adjust **Confidence Threshold** (0.20 default - lower = more faces detected, higher = fewer false positives)
- Adjust **Auto‑Assign Threshold** (0.60 default - higher = fewer suggestions, more manual review)

**Note:** These threshold settings are automatically saved and will be remembered across sessions.
:::

### Step 3: Add Person to Item (For Unassigned Faces)

After detection and suggestions, some faces may remain unassigned (didn't match anyone above the threshold).

1. Scroll down to "People in This Item" section
2. Click **+ Add Person** button
3. A new person entry appears with three parts:
   - **Person dropdown**: Select who this is
   - **👤 button**: Opens Person Manager to create/edit persons
   - **Position field**: Optional position/context (e.g., "in background", "holding baby")

### Step 4: Select or Create Person

**If person exists:**
1. Use the dropdown to select their name

**If person doesn't exist:**
1. Click the **👤** button
2. Person Manager window opens
3. Click **+ New Person** button
4. Enter:
   - First name
   - Last name(s) (can add multiple for maiden/married names)
   - TMGID (optional - for genealogy integration)
5. Click **Save Changes**
6. Person Manager automatically updates the Media Manager dropdown

### Step 5: Assign Face to Person (Manual Assignment)

For faces not assigned (or to fix incorrect matches):

1. After selecting a person, look at the "Face Match" column
2. If faces were detected, you'll see:
   - **Assign Face** dropdown showing available faces (e.g., "Face #1 (85%)")
3. Select which face belongs to this person
4. Click **Assign** button
5. Face is now linked to this person when saved!

**Bulk assignment:** If Stage 2 suggested matches, use **Assign selected faces** to apply all current selections at once.

To fix an incorrect match:
1. Click **Unassign** button next to the face
2. Then reassign to the correct person

::: tip Match Confidence
The percentage shown (e.g., "Face #1 (85%)") indicates detection confidence, not match confidence. This is simply how confident the AI is that it detected a face in that location.

For advanced users: See [Face Detection Advanced Guide](./face-detection-advanced.md) for detailed technical information about match thresholds, distance calculations, and troubleshooting.
:::

### Step 6: Repeat for All Unassigned Faces

For each remaining detected face that wasn't assigned:
1. Click **+ Add Person**
2. Select/create the person
3. Assign the corresponding face

### Step 7: Save Your Work

1. Click **Save Changes** at the bottom of Media Manager
2. Your face tags are now saved to the archive
3. Close Media Manager or move to next photo

## Face Badge Shortcuts and Overlays

Once you've tagged some faces in your archive:

- **Hover** over face badges to preview a single face region (even if overlays are enabled)
- **Hover** over the face assignment field in the People list to preview that face
- **Click** face badges to search for similar faces in your library
- This helps quickly identify people across multiple photos

::: info First Time Using Face Badges
When you click a face badge for the first time, you'll see a message explaining you need to tag faces first. This is expected - the search feature only works after you've created face descriptors by assigning faces to persons.
:::

## Managing People

### Person Manager Window

Access via **People > Manage Persons** or the 👤 button in Media Manager.

**Features:**
- Create new persons without needing a photo
- Edit existing person details
- Search persons by name or TMGID
- View all items featuring each person
- Manage face descriptors

### Person Information

- **First Name**: Given name
- **Last Names**: One or more surnames (maiden, married, etc.)
- **TMGID**: The Master Genealogist ID for integration with genealogy software
- **Person ID**: Stable UUID identifier (read-only)
- **Face Descriptors**: Items where this person has tagged faces (read-only)

## Using Face Detection Effectively

### Best Practices

1. **Create persons first**: Build your person library before detecting faces - this enables auto‑matching and suggestions
2. **One model per archive**: Stick to one detection model for consistency
3. **Tag systematically**: Work through one person across all photos before moving to the next
4. **Use suggestions**: Let the system handle obvious matches, focus on reviewing edge cases
5. **Verify detections**: AI isn't perfect - check and correct false positives and incorrect matches
6. **High quality photos**: Better resolution = better detection and matching
7. **Good lighting**: Well-lit faces detect more reliably
8. **Adjust thresholds**: Tune Auto‑Assign Threshold based on your tolerance for errors vs. manual review

### Managing Face Tags

**Unassign a Face:**
1. Click **Unassign** button next to assigned face
2. Face becomes available for reassignment

**Remove Face Detection:**
1. Delete the person entry (if not used elsewhere)
2. Or unassign all faces and re-detect

**Change Assigned Face:**
1. Unassign current face
2. Select different face from dropdown
3. Click Assign

## Troubleshooting

### Too Many Incorrect Suggestions

If faces are being suggested as the wrong people:
- Increase the **Auto-Assign Threshold** in Advanced Settings (e.g., from 0.60 to 0.70 or 0.75)
- Higher threshold = more conservative, fewer suggestions
- Click **Unassign** to fix any incorrect matches
- Your threshold adjustment will be saved for future sessions

### Not Enough Suggestions

If the system isn't suggesting faces you expect it to:
- Lower the **Auto-Assign Threshold** in Advanced Settings (e.g., from 0.60 to 0.50)
- Ensure you've tagged some faces for that person already (system needs training data)
- Check that person exists in your person library

### Faces Not Detected

- Ensure photo has sufficient resolution
- Check if faces are clearly visible (not obscured, blurry)
- Try different lighting conditions
- **Reduce the Confidence Threshold** in Advanced Settings before Face Detection
- Consider other face detection models - may not be well supported

### Too Many False Positives

- SSD can sometimes detect faces in patterns or objects
- Turn off "Show Overlays" and then mouse over face badges to select a face
- Simply ignore faces that overlap or are not needed
- **Increase the Confidence Threshold** in Advanced Settings before Face Detection

::: tip Settings Persistence
All threshold settings (Confidence Threshold and Auto-Assign Threshold) are automatically saved to your configuration file (shoeboxConfig.json) and will persist across application restarts.
:::

### Combine Methods

- Experiment with all of the techniques until you understand detection
- Don't expect all photos to work with the same settings
- Photo quality, lighting, focus, shadows, position of people make it challenging
- Consider re-ordering people in the people section if face rectangles are missing
- Order of people in the people list is saved in shoebox and is significant
- Numbers appear in Media Details after face detection
- If there is a TMGID links to website appear
- Use the position field to describe where a person is or is doing in the photo
- Use the Face badges to see possible matches - Click on the reference to see the photo

## Technical Details

- Uses face-api.js library
- Processing done locally (no cloud upload)
- Face descriptors stored in accessions.json
- Models stored in `app/resource/models/` directory

## Advanced: Downloading Additional Face Detection Models

If you need MTCNN or Tiny Face Detector models for challenging photos, you can download them using the included download script.

### Prerequisites

- Node.js installed on your system
- Internet connection
- Shoebox application installed

### Download Instructions

1. **Navigate to Shoebox directory** in your terminal:
   ```bash
   cd /path/to/shoebox
   ```

2. **Run the download script**:
   ```bash
   node scripts/download-additional-models.js
   ```

3. **Wait for download** (downloads from official face-api.js repository):
   ```
   Downloading additional face detection models...
   
   Downloading MTCNN models...
   ✓ Downloaded: mtcnn_model-shard1
   ✓ Downloaded: mtcnn_model-weights_manifest.json
   
   Downloading Tiny Face Detector models...
   ✓ Downloaded: tiny_face_detector_model-shard1
   ✓ Downloaded: tiny_face_detector_model-weights_manifest.json
   
   ✓ All additional models downloaded successfully!
   ```

4. **Restart Shoebox** - New models are detected automatically on startup

### Model Selection in Shoebox

Once additional models are downloaded:

1. Open **Media Manager** window
2. Go to **Advanced Settings** (gear icon)
3. Choose your preferred detection model:
   - **SSD MobileNetV1** (default, fast)
   - **MTCNN** (profiles, difficult angles)
   - **Tiny Face Detector** (small/distant faces)

### Verifying Installation

Models are installed in:
```
app/resource/models/
├── ssd_mobilenetv1_model-* (default, always present)
├── face_landmark_68_model-* (required, always present)
├── face_recognition_model-* (required, always present)
├── mtcnn_model-* (optional, downloaded)
└── tiny_face_detector_model-* (optional, downloaded)
```

Check console output when starting Shoebox to confirm models loaded:
```
Loading face detection models...
MTCNN model loaded
TinyFace model loaded
Face detection models loaded successfully
```

### Troubleshooting Downloads

**Download fails with network error:**
- Check internet connection
- Try again later (GitHub may be temporarily unavailable)
- Download models manually from [face-api.js models repository](https://github.com/justadudewhohacks/face-api.js-models)

**Models not detected after download:**
- Verify files are in `app/resource/models/` directory
- Check file permissions (should be readable)
- Restart Shoebox completely

**Script not found:**
- Ensure you're in the correct directory (shoebox root)
- Check that `scripts/download-additional-models.js` exists

## Related

- [Face Detection Advanced Guide](./face-detection-advanced.md) - Technical details, thresholds, and troubleshooting
- [Person Manager](./metadata.md#people)
- [Keyboard Shortcuts](../guide/keyboard-shortcuts.md#filter-toggles)
- [Archive Data Structure](../guide/data-structure.md#face-biometric-data) - How face data is stored
