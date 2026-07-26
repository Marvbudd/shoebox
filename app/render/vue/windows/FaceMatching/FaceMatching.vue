<template>
  <div class="container">
    <header>
      <p class="subtitle" v-if="descriptorCount > 0">
        {{ personName }} has {{ descriptorCount }} total descriptor{{ descriptorCount === 1 ? '' : 's' }}.
      </p>
      <p class="subtitle detail" v-if="descriptorCount > 0 && excludedDescriptorCount > 0">
        {{ activeDescriptorCount }} active, {{ excludedDescriptorCount }} excluded from matching.
      </p>

      <div class="review-toolbar" v-if="descriptorCount > 0">
        <div class="group-header" v-if="currentDescriptorGroup">
          <div class="group-left">
            <h3>{{ currentDescriptorTitle }}</h3>
            <p>{{ currentDescriptorItems.length }} candidate(s), {{ selectedCountForCurrentDescriptor }} selected</p>
            <p class="descriptor-confidence" v-if="currentDescriptorConfidenceText">Descriptor confidence: {{ currentDescriptorConfidenceText }}</p>
            <span v-if="isCurrentDescriptorExcluded" class="descriptor-state excluded">Excluded from matching</span>
            <div class="descriptor-nav">
              <button class="btn-secondary btn-small" @click="prevDescriptor" :disabled="currentDescriptorIndex <= 0">◀ Previous</button>
              <span class="descriptor-nav-text">Descriptor {{ currentDescriptorIndex + 1 }} of {{ descriptorCount }}</span>
              <button class="btn-secondary btn-small" @click="nextDescriptor" :disabled="currentDescriptorIndex >= descriptorCount - 1">Next ▶</button>
              <button
                class="btn-secondary"
                @click="excludeCurrentDescriptor"
                :disabled="excludingDescriptor || assigningDescriptor || loadingDescriptor || !currentDescriptorGroup?.descriptorKey || isCurrentDescriptorExcluded"
                title="Exclude this descriptor from future matching while preserving face-region behavior"
              >
                {{ isCurrentDescriptorExcluded ? 'Excluded' : (excludingDescriptor ? 'Excluding...' : 'Exclude Descriptor') }}
              </button>
              <button
                class="btn-secondary"
                @click="assignSelectedForCurrentDescriptor"
                :disabled="selectedAssignableInCurrentDescriptor === 0 || assigningDescriptor || loadingDescriptor"
                title="Commit selected faces for this descriptor to the selected person"
              >
                {{ assigningDescriptor ? 'Assigning...' : `Assign Selected (${selectedAssignableInCurrentDescriptor})` }}
              </button>
            </div>
          </div>

          <div v-if="currentDescriptorPreview" class="descriptor-preview-wrap">
            <img :src="currentDescriptorPreview" alt="Descriptor reference face" class="face-preview descriptor-face-preview" />
          </div>

          <div class="group-right">
            <button class="btn-secondary" @click="closeWindow">Done</button>
            <div class="group-actions">
              <button
                class="btn-secondary btn-small"
                @click="openDescriptorInMediaManager"
                :disabled="!currentDescriptorGroup?.descriptorLink"
                title="Open descriptor source item in Media Manager"
              >
                Edit Media
              </button>
              <button class="btn-secondary btn-small" @click="selectAllInCurrentDescriptor" title="Select all candidates in this descriptor list">Select All</button>
              <button class="btn-secondary btn-small" @click="clearAllInCurrentDescriptor" title="Clear selected candidates in this descriptor list">Clear All</button>
            </div>
            <p class="status-inline" v-if="statusMessage">{{ statusMessage }}</p>
          </div>
        </div>
      </div>
    </header>

    <main>
      <section class="matches-section" v-if="descriptorCount > 0">
        <div class="group-card" v-if="currentDescriptorGroup">
          <div v-if="isCurrentDescriptorExcluded" class="excluded-descriptor-note">
            This descriptor is excluded from future matching. Manual selection/assignment from this list remains available.
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Accept</th>
                  <th>Link</th>
                  <th>Face</th>
                  <th>% Match</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="match in currentDescriptorItems"
                  :key="matchSelectionKey(match)"
                  :class="matchRowClass(match)"
                  @click="handleMatchRowClick(match, $event)"
                >
                  <td>
                    <input
                      type="checkbox"
                      :checked="isCandidateSelected(match)"
                      @change.stop="toggleCandidate(match)"
                      @click.stop
                    />
                  </td>
                  <td>{{ match.link }}</td>
                  <td>
                    <img
                      v-if="getCandidatePreview(match)"
                      :src="getCandidatePreview(match)"
                      alt="Candidate face excerpt"
                      class="face-preview"
                    />
                    <span v-else class="excerpt-loading">Loading...</span>
                  </td>
                  <td>{{ Number(match.percentMatch || 0) }}%</td>
                  <td>
                    <button
                      type="button"
                      class="btn-secondary btn-small"
                      @click.stop="openMatchInMediaManager(match)"
                      :disabled="!match?.link"
                      title="Open this item in Media Manager"
                    >
                      Edit Media
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="status-section" v-if="descriptorCount === 0">
        <h2>No Matches</h2>
        <p class="empty">No descriptor matches were generated for this person.</p>
      </section>

      <section class="status-section" v-if="descriptorCount > 0 && !currentDescriptorGroup">
        <h2>No Matches</h2>
        <p class="empty">No candidate matches were generated for this descriptor.</p>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const personID = ref('');
const personName = ref('Selected Person');
const descriptorCount = ref(0);
const descriptorOptions = ref({
  minConfidence: 0.6,
  perDescriptorLimit: 60,
  maxDescriptors: 250
});
const activeDescriptorCount = ref(0);
const excludedDescriptorCount = ref(0);
const assignedLinks = ref(new Set());
const selectedCandidates = ref(new Set());
const currentDescriptorIndex = ref(0);
const currentDescriptorGroup = ref(null);
const candidatePreviewCache = ref({});
const descriptorPreviewCache = ref({});
const assigningDescriptor = ref(false);
const excludingDescriptor = ref(false);
const loadingDescriptor = ref(false);
const statusMessage = ref('');
const totalUnresolvedCandidates = ref(0);
const imagePathCache = new Map();
const imageObjectCache = new Map();
let descriptorRefreshTimer = null;
let descriptorLoadRequestId = 0;

const currentDescriptorItems = computed(() => Array.isArray(currentDescriptorGroup.value?.items) ? currentDescriptorGroup.value.items : []);
const isCurrentDescriptorExcluded = computed(() => currentDescriptorGroup.value?.excluded === true);
const currentDescriptorTitle = computed(() => {
  const group = currentDescriptorGroup.value;
  if (!group) return 'Descriptor';
  const label = group.descriptorLink || 'unknown source';
  const idx = Number.isFinite(group.descriptorIndex) ? group.descriptorIndex + 1 : currentDescriptorIndex.value + 1;
  return `Descriptor ${idx} from ${label}`;
});
const currentDescriptorPreview = computed(() => {
  const key = currentDescriptorGroup.value?.descriptorKey;
  return key ? descriptorPreviewCache.value[key] || null : null;
});
const currentDescriptorConfidenceText = computed(() => {
  const groupConfidence = currentDescriptorGroup.value?.descriptorConfidence;
  if (Number.isFinite(Number(groupConfidence))) {
    const pct = Math.round(Math.max(0, Math.min(1, Number(groupConfidence))) * 100);
    return `${pct}%`;
  }

  const items = currentDescriptorItems.value;
  if (items.length === 0) {
    return null;
  }

  const topCandidatePercent = Number(items[0]?.percentMatch);
  if (Number.isFinite(topCandidatePercent)) {
    return `${Math.max(0, Math.min(100, Math.round(topCandidatePercent)))}% (top candidate)`;
  }

  return null;
});
const selectedCandidateCount = computed(() => selectedCandidates.value.size);
const selectedCountForCurrentDescriptor = computed(() => {
  const keys = currentDescriptorItems.value.map(matchSelectionKey);
  return keys.filter(key => selectedCandidates.value.has(key)).length;
});
const selectedAssignableInCurrentDescriptor = computed(() => {
  return currentDescriptorItems.value.filter(match => (
    selectedCandidates.value.has(matchSelectionKey(match))
    && typeof match?.candidateID === 'string'
    && !!match.candidateID
    && typeof match?.link === 'string'
    && !!match.link
  )).length;
});

const isMatchDuplicateAssigned = (match) => {
  const link = typeof match?.link === 'string' ? match.link : '';
  return !!link && assignedLinks.value.has(link);
};

const matchRowClass = (match) => {
  return {
    'match-row-selected': isCandidateSelected(match),
    'match-row-duplicate': isMatchDuplicateAssigned(match)
  };
};

const decodePayloadFromLocation = () => {
  const params = new URLSearchParams(window.location.search);
  const payloadParam = params.get('payload');
  if (!payloadParam) {
    return null;
  }

  try {
    return JSON.parse(decodeURIComponent(payloadParam));
  } catch (error) {
    console.error('Failed to parse Face Matching payload:', error);
    return null;
  }
};

const applyPayload = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return;
  }

  personID.value = payload.personID || '';
  personName.value = payload.personName || payload.personID || 'Selected Person';
  descriptorCount.value = Math.max(0, Number(payload.descriptorCount || 0));
  currentDescriptorIndex.value = Math.max(0, Math.min(descriptorCount.value - 1, Number(payload.descriptorIndex || 0)));
  currentDescriptorGroup.value = payload.descriptorGroup || null;
  totalUnresolvedCandidates.value = Math.max(0, Number(payload.totalUnresolvedCandidates || 0));
  activeDescriptorCount.value = Math.max(0, Number(payload.activeDescriptorCount ?? descriptorCount.value));
  excludedDescriptorCount.value = Math.max(0, Number(payload.excludedDescriptorCount ?? Math.max(0, descriptorCount.value - activeDescriptorCount.value)));
  descriptorOptions.value = {
    minConfidence: Number.isFinite(Number(payload.minConfidence)) ? Number(payload.minConfidence) : 0.6,
    perDescriptorLimit: Math.max(1, Number(payload.perDescriptorLimit || 60)),
    maxDescriptors: Math.max(1, Number(payload.maxDescriptors || 250))
  };
  assignedLinks.value = new Set(
    Array.isArray(payload.assignedLinks)
      ? payload.assignedLinks.filter(link => typeof link === 'string' && link.length > 0)
      : []
  );

  selectedCandidates.value = new Set();
  preloadCurrentDescriptorExcerpts();
};

const loadDescriptor = async (descriptorIndex) => {
  if (!personID.value || descriptorCount.value <= 0) {
    currentDescriptorGroup.value = null;
    return;
  }

  if (!window.electronAPI?.getMatchUnassignedDescriptor) {
    statusMessage.value = 'Descriptor loading API is unavailable in this window.';
    return;
  }

  const normalizedIndex = Math.max(0, Math.min(descriptorCount.value - 1, Number(descriptorIndex) || 0));
  const requestId = ++descriptorLoadRequestId;
  const requestOptions = {
    minConfidence: Number(descriptorOptions.value?.minConfidence || 0.6),
    perDescriptorLimit: Number(descriptorOptions.value?.perDescriptorLimit || 60),
    maxDescriptors: Number(descriptorOptions.value?.maxDescriptors || 250)
  };
  loadingDescriptor.value = true;
  try {
    const result = await window.electronAPI.getMatchUnassignedDescriptor(
      personID.value,
      normalizedIndex,
      requestOptions
    );

    if (requestId !== descriptorLoadRequestId) {
      return;
    }

    if (!result?.success) {
      statusMessage.value = `Unable to load descriptor: ${result?.error || 'Unknown error'}`;
      return;
    }

    descriptorCount.value = Math.max(0, Number(result.descriptorCount || 0));
    activeDescriptorCount.value = Math.max(0, Number(result.activeDescriptorCount ?? descriptorCount.value));
    excludedDescriptorCount.value = Math.max(0, Number(result.excludedDescriptorCount ?? Math.max(0, descriptorCount.value - activeDescriptorCount.value)));
    currentDescriptorIndex.value = Math.max(0, Number(result.descriptorIndex || normalizedIndex));
    currentDescriptorGroup.value = result.descriptorGroup || null;
    totalUnresolvedCandidates.value = Math.max(0, Number(result.totalUnresolvedCandidates || totalUnresolvedCandidates.value));
    selectedCandidates.value = new Set();
    await preloadCurrentDescriptorExcerpts();

    if (requestId !== descriptorLoadRequestId) {
      return;
    }
  } catch (error) {
    if (requestId !== descriptorLoadRequestId) {
      return;
    }

    statusMessage.value = `Unable to load descriptor: ${error?.message || String(error)}`;
  } finally {
    if (requestId === descriptorLoadRequestId) {
      loadingDescriptor.value = false;
    }
  }
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const expandRegionForContext = (region, factor = 1.25) => {
  if (!region) return null;

  const x = Number(region.x);
  const y = Number(region.y);
  const w = Number(region.w);
  const h = Number(region.h);
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
    return null;
  }

  return {
    x: clamp(x, 0, 1),
    y: clamp(y, 0, 1),
    w: clamp(w * factor, 0.001, 1),
    h: clamp(h * factor, 0.001, 1)
  };
};

const getImagePath = async (link) => {
  if (imagePathCache.has(link)) {
    return imagePathCache.get(link);
  }
  const mediaPath = await window.electronAPI.getMediaPath('photo', link);
  imagePathCache.set(link, mediaPath || null);
  return mediaPath || null;
};

const getImageObject = async (link) => {
  if (imageObjectCache.has(link)) {
    return imageObjectCache.get(link);
  }

  const src = await getImagePath(link);
  if (!src) {
    return null;
  }

  const img = new Image();
  const loaded = await new Promise((resolve) => {
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

  if (loaded) {
    imageObjectCache.set(link, loaded);
  }

  return loaded;
};

const buildExcerptDataUrl = async (link, region) => {
  if (!link || !region) {
    return null;
  }

  const expanded = expandRegionForContext(region, 1.25);
  if (!expanded) {
    return null;
  }

  const img = await getImageObject(link);
  if (!img || !img.width || !img.height) {
    return null;
  }

  const cropW = clamp(expanded.w * img.width, 2, img.width);
  const cropH = clamp(expanded.h * img.height, 2, img.height);
  const centerX = clamp(expanded.x * img.width, 0, img.width);
  const centerY = clamp(expanded.y * img.height, 0, img.height);
  const cropX = clamp(centerX - cropW / 2, 0, Math.max(0, img.width - cropW));
  const cropY = clamp(centerY - cropH / 2, 0, Math.max(0, img.height - cropH));

  const outWidth = 120;
  const outHeight = Math.max(72, Math.min(160, Math.round(outWidth * (cropH / cropW))));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outWidth, outHeight);
  return canvas.toDataURL('image/png');
};

const getCandidatePreview = (match) => {
  const key = matchSelectionKey(match);
  return candidatePreviewCache.value[key] || null;
};

const matchSelectionKey = (match) => `${match?.candidateID || 'candidate'}:${match?.link || ''}`;

const findSelectedMatchForLink = (link, excludingKey = null) => {
  if (!link) return null;

  for (const item of currentDescriptorItems.value) {
    if (item?.link !== link) {
      continue;
    }

    const key = matchSelectionKey(item);
    if (excludingKey && key === excludingKey) {
      continue;
    }

    if (selectedCandidates.value.has(key)) {
      return item;
    }
  }

  return null;
};

const confirmDiscardPendingSelections = async (directionLabel) => {
  if (selectedCandidates.value.size === 0) {
    return true;
  }

  return window.confirm(
    `You have ${selectedCandidates.value.size} selected face(s) that are not assigned yet. Discard them and go to the ${directionLabel} descriptor?`
  );
};

const preloadCurrentDescriptorExcerpts = async () => {
  const candidateUpdates = {};
  const descriptorUpdates = {};

  const group = currentDescriptorGroup.value;
  if (!group) {
    return;
  }

  const descriptorKey = group?.descriptorKey;
  if (descriptorKey && !descriptorPreviewCache.value[descriptorKey] && group?.descriptorRegion && group?.descriptorLink) {
    const excerpt = await buildExcerptDataUrl(group.descriptorLink, group.descriptorRegion);
    if (excerpt) {
      descriptorUpdates[descriptorKey] = excerpt;
    }
  }

  const items = Array.isArray(group?.items) ? group.items : [];
  for (const match of items) {
    const candidateKey = matchSelectionKey(match);
    if (!candidatePreviewCache.value[candidateKey] && match?.candidateRegion && match?.link) {
      const excerpt = await buildExcerptDataUrl(match.link, match.candidateRegion);
      if (excerpt) {
        candidateUpdates[candidateKey] = excerpt;
      }
    }
  }

  if (Object.keys(candidateUpdates).length > 0) {
    candidatePreviewCache.value = {
      ...candidatePreviewCache.value,
      ...candidateUpdates
    };
  }

  if (Object.keys(descriptorUpdates).length > 0) {
    descriptorPreviewCache.value = {
      ...descriptorPreviewCache.value,
      ...descriptorUpdates
    };
  }
};

const isCandidateSelected = (match) => selectedCandidates.value.has(matchSelectionKey(match));

const toggleCandidate = (match) => {
  const key = matchSelectionKey(match);
  if (!key) return;

  if (selectedCandidates.value.has(key)) {
    selectedCandidates.value.delete(key);
  } else {
    const selectedForSameLink = findSelectedMatchForLink(match?.link, key);
    if (selectedForSameLink) {
      const replace = window.confirm(
        'A face is already selected for this media item. Replace it with this selection?'
      );

      if (!replace) {
        statusMessage.value = 'Kept existing face selection for this media item.';
        return;
      }

      selectedCandidates.value.delete(matchSelectionKey(selectedForSameLink));
    }

    if (isMatchDuplicateAssigned(match)) {
      statusMessage.value = 'Warning: this person is already assigned to this media item. This selection will be skipped at Assign.';
    }

    selectedCandidates.value.add(key);
  }
  selectedCandidates.value = new Set(selectedCandidates.value);
};

const handleMatchRowClick = (match, event) => {
  const target = event?.target;
  if (!target || !(target instanceof Element)) {
    toggleCandidate(match);
    return;
  }

  if (target.closest('input, button, a')) {
    return;
  }

  toggleCandidate(match);
};

const selectAllInCurrentDescriptor = () => {
  const chosenByLink = new Map();
  for (const item of currentDescriptorItems.value) {
    const link = item?.link || '';
    if (!link || chosenByLink.has(link)) {
      continue;
    }
    chosenByLink.set(link, matchSelectionKey(item));
  }

  selectedCandidates.value = new Set(chosenByLink.values());
  statusMessage.value = `Selected ${selectedCandidates.value.size} face(s), limited to one per media item.`;
};

const clearAllInCurrentDescriptor = () => {
  for (const item of currentDescriptorItems.value) {
    selectedCandidates.value.delete(matchSelectionKey(item));
  }
  selectedCandidates.value = new Set(selectedCandidates.value);
};

const openMediaManagerForLink = async (link) => {
  const normalizedLink = typeof link === 'string' ? link : '';
  if (!normalizedLink) {
    statusMessage.value = 'Unable to open Media Manager: missing item link.';
    return;
  }

  if (!window.electronAPI?.editItem) {
    statusMessage.value = 'Edit Media API is unavailable in this window.';
    return;
  }

  try {
    await window.electronAPI.editItem(normalizedLink);
  } catch (error) {
    statusMessage.value = `Failed to open Media Manager: ${error?.message || String(error)}`;
  }
};

const openDescriptorInMediaManager = async () => {
  await openMediaManagerForLink(currentDescriptorGroup.value?.descriptorLink);
};

const openMatchInMediaManager = async (match) => {
  await openMediaManagerForLink(match?.link);
};

const assignSelectedForCurrentDescriptor = async () => {
  if (assigningDescriptor.value) {
    return;
  }

  const matches = currentDescriptorItems.value
    .filter(match => selectedCandidates.value.has(matchSelectionKey(match)))
    .filter(match => typeof match?.candidateID === 'string' && !!match.candidateID && typeof match?.link === 'string' && !!match.link)
    .map(match => ({
      candidateID: match.candidateID,
      link: match.link,
      descriptorKey: match.descriptorKey
    }));

  if (!personID.value || matches.length === 0) {
    statusMessage.value = 'No selected candidates to assign for this descriptor.';
    return;
  }

  if (!window.electronAPI?.assignFaceMatchingSelections) {
    statusMessage.value = 'Assignment API is unavailable in this window.';
    return;
  }

  assigningDescriptor.value = true;
  statusMessage.value = '';
  try {
    const result = await window.electronAPI.assignFaceMatchingSelections({
      personID: personID.value,
      matches
    });

    if (!result?.success) {
      statusMessage.value = `Assignment failed: ${result?.error || 'Unknown error'}`;
      return;
    }

    const assigned = Number(result.assignedCount || 0);
    const skipped = Number(result.skippedCount || 0);
    const duplicateAssignedSkips = Number(result.duplicateAssignedSkips || 0);
    const conflictSelectionSkips = Number(result.conflictSelectionSkips || 0);
    const invalidSelectionSkips = Number(result.invalidSelectionSkips || 0);

    if (Array.isArray(result.assignedLinks) && result.assignedLinks.length > 0) {
      for (const link of result.assignedLinks) {
        if (typeof link === 'string' && link.length > 0) {
          assignedLinks.value.add(link);
        }
      }
      assignedLinks.value = new Set(assignedLinks.value);
    }

    await loadDescriptor(currentDescriptorIndex.value);

    if (skipped > 0) {
      const parts = [];
      if (duplicateAssignedSkips > 0) {
        parts.push(`${duplicateAssignedSkips} already assigned to this item`);
      }
      if (conflictSelectionSkips > 0) {
        parts.push(`${conflictSelectionSkips} conflicting selections on same media item`);
      }
      if (invalidSelectionSkips > 0) {
        parts.push(`${invalidSelectionSkips} stale/invalid selections`);
      }
      const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
      statusMessage.value = `Assigned ${assigned} face(s); skipped ${skipped}${detail}.`;
    } else {
      statusMessage.value = `Assigned ${assigned} face(s).`;
    }
  } catch (error) {
    statusMessage.value = `Assignment failed: ${error?.message || String(error)}`;
  } finally {
    assigningDescriptor.value = false;
  }
};

const excludeCurrentDescriptor = async () => {
  if (isCurrentDescriptorExcluded.value) {
    statusMessage.value = 'This descriptor is already excluded.';
    return;
  }

  const descriptorKey = currentDescriptorGroup.value?.descriptorKey;
  if (!personID.value || !descriptorKey) {
    statusMessage.value = 'No descriptor selected to exclude.';
    return;
  }

  if (!window.electronAPI?.excludeDescriptorFromMatching) {
    statusMessage.value = 'Exclude API is unavailable in this window.';
    return;
  }

  const confirmed = window.confirm(
    'Exclude this descriptor from future matching? Face regions stay visible, but this descriptor will no longer be used for matching.'
  );
  if (!confirmed) {
    return;
  }

  excludingDescriptor.value = true;
  statusMessage.value = '';
  try {
    const result = await window.electronAPI.excludeDescriptorFromMatching(personID.value, descriptorKey);
    if (!result?.success) {
      statusMessage.value = `Exclude failed: ${result?.error || 'Unknown error'}`;
      return;
    }

    await loadDescriptor(currentDescriptorIndex.value);
    if (activeDescriptorCount.value === 0) {
      statusMessage.value = 'Descriptor excluded. No active descriptors remain for this person.';
    } else {
      statusMessage.value = `Descriptor excluded. ${activeDescriptorCount.value} active descriptor(s) remaining.`;
    }
  } catch (error) {
    statusMessage.value = `Exclude failed: ${error?.message || String(error)}`;
  } finally {
    excludingDescriptor.value = false;
  }
};

const nextDescriptor = async () => {
  if (currentDescriptorIndex.value < descriptorCount.value - 1) {
    const canNavigate = await confirmDiscardPendingSelections('next');
    if (!canNavigate) {
      return;
    }
    await loadDescriptor(currentDescriptorIndex.value + 1);
  }
};

const prevDescriptor = async () => {
  if (currentDescriptorIndex.value > 0) {
    const canNavigate = await confirmDiscardPendingSelections('previous');
    if (!canNavigate) {
      return;
    }
    await loadDescriptor(currentDescriptorIndex.value - 1);
  }
};

const closeWindow = () => {
  window.close();
};

const scheduleDescriptorRefresh = (reason = 'updated') => {
  if (!personID.value || descriptorCount.value <= 0) {
    return;
  }

  if (descriptorRefreshTimer) {
    clearTimeout(descriptorRefreshTimer);
  }

  descriptorRefreshTimer = setTimeout(async () => {
    descriptorRefreshTimer = null;

    if (assigningDescriptor.value || excludingDescriptor.value || loadingDescriptor.value) {
      // Retry once workflows settle.
      scheduleDescriptorRefresh(reason);
      return;
    }

    await loadDescriptor(currentDescriptorIndex.value);
    statusMessage.value = `Descriptor list refreshed (${reason}).`;
  }, 180);
};

onMounted(() => {
  applyPayload(decodePayloadFromLocation());
  if (descriptorCount.value > 0 && !currentDescriptorGroup.value) {
    loadDescriptor(currentDescriptorIndex.value);
  }

  if (window.electronAPI?.onFaceMatchingLoad) {
    window.electronAPI.onFaceMatchingLoad((payload) => {
      applyPayload(payload);
      if (descriptorCount.value > 0 && !currentDescriptorGroup.value) {
        loadDescriptor(currentDescriptorIndex.value);
      }
    });
  }

  if (window.electronAPI?.onItemSaved) {
    window.electronAPI.onItemSaved(() => {
      scheduleDescriptorRefresh('item saved');
    });
  }

  if (window.electronAPI?.onItemDeleted) {
    window.electronAPI.onItemDeleted(() => {
      scheduleDescriptorRefresh('item deleted');
    });
  }
});

onBeforeUnmount(() => {
  if (descriptorRefreshTimer) {
    clearTimeout(descriptorRefreshTimer);
    descriptorRefreshTimer = null;
  }
});
</script>

<style scoped>
.container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
}

header {
  background: #ffffff;
  border-bottom: 1px solid #d9e1ec;
  padding: 12px 16px;
  position: sticky;
  top: 0;
  z-index: 30;
}

.subtitle {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #334155;
}

.subtitle.detail {
  margin-top: -4px;
  color: #64748b;
}

.descriptor-state {
  display: inline-block;
  width: fit-content;
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.descriptor-state.excluded {
  background: #fff3cd;
  color: #8a6d1d;
  border: 1px solid #f1df9f;
}

main {
  padding: 12px 16px;
  overflow: auto;
}

.btn-primary,
.btn-secondary {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 9px 12px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary {
  background: #1d4ed8;
  color: #ffffff;
  border-color: #1d4ed8;
}

.btn-primary:disabled {
  background: #94a3b8;
  border-color: #94a3b8;
  cursor: not-allowed;
}

.btn-secondary {
  background: #ffffff;
  color: #0f172a;
}

.matches-section {
  background: #ffffff;
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 14px;
}

.group-card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}

.excluded-descriptor-note {
  margin: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #f1df9f;
  background: #fff8e1;
  color: #6b550d;
  font-size: 13px;
}

.review-toolbar {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.group-left {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group-header h3 {
  margin: 0;
  font-size: 14px;
}

.group-header p {
  margin: 4px 0 0 0;
  color: #64748b;
  font-size: 12px;
}

.descriptor-confidence {
  margin: 2px 0 0 0;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
}

.group-actions {
  display: flex;
  gap: 6px;
}

.group-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.status-inline {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  max-width: 280px;
  text-align: right;
}

.match-row-selected {
  background: #eff6ff;
}

.match-row-duplicate {
  background: #fff7ed;
}

.descriptor-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.descriptor-nav-text {
  font-size: 13px;
  color: #334155;
}

.descriptor-preview-wrap {
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
}

.descriptor-face-preview {
  border: none;
}

.btn-small {
  padding: 6px 9px;
  font-size: 12px;
}

h2 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.empty {
  margin: 0;
  color: #64748b;
}

ol {
  margin: 0;
  padding-left: 18px;
}

li {
  margin-bottom: 4px;
  font-size: 13px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table-scroll {
  max-height: calc(100vh - 280px);
  overflow: auto;
}

th,
td {
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  padding: 7px 6px;
  vertical-align: middle;
}

th {
  font-weight: 600;
  color: #334155;
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f8fafc;
}

.face-preview {
  width: 120px;
  max-height: 120px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #d9e1ec;
}

.excerpt-loading {
  color: #64748b;
  font-size: 12px;
}
</style>
