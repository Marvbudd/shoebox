# Face Detection - Advanced Technical Details

## Understanding Face Detection Percentages

The percentages you see in Shoebox's face detection feature represent **two completely different metrics**, which can be confusing. Here's what they mean:

### 1. Detection Confidence (Detector Certainty)

**What it is:** How confident the AI model is that it found an actual face in the image.

**Where you see it:** 
- In the dropdown when assigning unmatched faces: "Face #1 (95%)"
- This percentage comes from the face detection model (SSD, MTCNN, etc.)

**What it means:**
- **90-100%**: The detector is very confident this is a face
- **70-89%**: Probable face, but some uncertainty
- **50-69%**: Low confidence, might be a false positive
- **Below 50%**: Likely not a face (filtered out by minimum confidence setting)

**Example:** If you see "Face #1 (95%)" in the unmatched dropdown, it means the detector is 95% sure it found a face at that location.

### 2. Match Confidence (Biometric Similarity)

**What it is:** How similar two face descriptors are, measuring if they're likely the same person.

**Where you see it:**
- Next to matched faces: "Face #1 (97%)" means 97% biometric match

**What it means:**
| Confidence | Interpretation | Typical Scenario |
|------------|----------------|------------------|
| **100%** | Perfect match | Same detection run (distance 0.0) |
| **95-99%** | Near-perfect | Re-detection of same photo |
| **85-94%** | Strong match | Same person, similar conditions |
| **70-84%** | Good match | Same person, different conditions |
| **50-69%** | Questionable | Might be same person, needs review |
| **Below 50%** | Weak match | Probably different people |

### Technical: Distance to Confidence Mapping

For advanced users who want to understand the underlying math, here's the complete mapping between the internal distance metric and the displayed confidence percentage:

| Distance | Confidence | Technical Meaning |
|----------|------------|-------------------|
| 0.00 | 100% | Identical descriptors (128-D vectors) |
| 0.03 | 95% | Near-identical (floating-point variance) |
| 0.06 | 90% | Very similar |
| 0.12 | 80% | Strong similarity |
| 0.18 | 70% | Good similarity |
| 0.24 | 60% | Moderate similarity |
| 0.30 | 50% | Questionable similarity |
| 0.42 | 30% | Low similarity |
| 0.60 | 0% | Display scale limit |
| > 0.60 | Negative | Different people |

**Formula:** `Confidence = (1 - distance / 0.6) × 100%`

Where **distance** is the Euclidean distance between two 128-dimensional face descriptor vectors.

::: tip For Most Users
You don't need to understand distances! Just use the confidence percentages shown in the UI. Higher percentages mean better matches.
:::

## Matching Thresholds

Shoebox uses **one strict matching threshold (0.05)** for auto-matching decisions, plus **one display scale (0.6)** for calculating percentages.

## Matching Thresholds

Shoebox uses a **99% confidence threshold** for auto-matching decisions.

### Auto-Match Threshold: 99% Confidence

**Purpose:** Determines whether a detected face is **automatically matched** to a person or goes to the **manual assignment** list.

**Decision Logic:**
- **≥ 99% confidence** → Face is **automatically matched** to the person (shows next to their name)
- **< 99% confidence** → Face goes to **unmatched list** (you choose from dropdown)

::: details Technical: What does 99% mean?
Internally, 99% confidence corresponds to a distance of 0.006 or less between face descriptors. The system actually uses distance < 0.05 for a small safety margin, which is approximately 92% confidence, but in practice all auto-matches will be 99-100% due to the nature of re-detection.
:::

**Why so strict?** This threshold is designed for **re-detecting the same image**:
- Same image + same model should produce 100% confidence (identical descriptors)
- If confidence < 99%, something is suspicious (wrong model, data corruption, image changed)
- Better to require manual verification than auto-match incorrectly

**What this means for you:**
- Re-detecting faces in a photo you've already tagged will auto-match at 100% confidence
- Detecting faces in a **new photo** of someone already in your archive will **NOT** auto-match (typical confidence 60-90% for different photos)
- You'll manually assign faces from the dropdown - which gives you control and prevents false positives

### Why is re-detection different from new photos?

The same person photographed under different conditions will have **60-90% confidence** matches. This is **normal and expected** due to:
- Different lighting
- Different angles
- Different facial expressions
- Years between photos
- Different cameras/quality

However, re-detecting faces in the **same image** with the **same model** should produce **100% confidence** (identical descriptors). If not, it indicates something is wrong.

**By using a 99% confidence threshold**, Shoebox:
- ✅ Auto-matches re-detections (100% confidence)
- ✅ Prevents false positives from different photos (typically 60-90%)
- ✅ Puts uncertain matches in your control (manual dropdown)
- ✅ Avoids accumulated matching errors over time

## Face Detection Models

### SSD MobileNetV1 (Default)
- **Best for:** General purpose, most photos
- **Pros:** Fast, reliable, good balance
- **Cons:** May miss very small or angled faces
- **Descriptor compatibility:** SSD only

### MTCNN (Optional Download)
- **Best for:** Profile shots, difficult angles
- **Pros:** Better at detecting faces in challenging poses
- **Cons:** Slower, may detect false positives
- **Descriptor compatibility:** MTCNN only

### Tiny Face Detector (Optional Download)
- **Best for:** Small or distant faces
- **Pros:** Excellent for group photos with small faces
- **Cons:** Less accurate for close-up shots
- **Descriptor compatibility:** Tiny only

**Critical:** Descriptors from different models are **not comparable**. A face detected with SSD cannot be matched to a descriptor created with MTCNN. Always use the same model for matching.

## Common Questions

### "Why aren't faces auto-matching across different photos?"
By design! Shoebox only auto‑assigns re‑matches within the same photo. Matches from the Person Library are **suggested** and require manual assignment. This gives you control over cross‑photo identifications.

### "Getting 60-80% matches for same person in different photos"
This is normal! Different lighting, angle, and expression reduce confidence. If visual inspection confirms same person, manually assign from dropdown.

### "Face shows 54% confidence - is this bad?"
Questionable match. Could be same person under very different conditions, or different person. Review carefully - if unsure, leave unassigned or add notes in the Position field.

### "All faces showing as unmatched after re-detection"
Different model selected than original detection. Check which model was used previously in Media Manager and select the same one.

### "Face matches disappeared after editing"
faceBioData was cleared when detecting with different model. Always use same model for consistency.

## See Also
- [Face Detection Overview](face-detection.md)
- [Data Structure](../guide/data-structure.md)
- [Validation](metadata.md#validation)
