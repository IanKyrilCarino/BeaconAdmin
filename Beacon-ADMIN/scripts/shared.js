// ==========================
// SHARED SCRIPT (v10 - Manual Announcement & Scheduled Date Fix)
// (Contains universal utilities, UI logic, unified modals, and all page/filter event listeners)
// ==========================
// Loaded SECOND on every page

// --- GLOBAL UTILITY FUNCTIONS ---

/**
 * Shows a temporary success popup.
 * @param {string} message The message to display.
 */
window.showSuccessPopup = function(message) {
const popup = document.createElement('div');
popup.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-[9999] transform transition-transform duration-300 translate-x-0';
popup.innerHTML = `
  <div class="flex items-center space-x-3">
    <span class="material-icons text-white">check_circle</span>
    <span class="font-medium">${message}</span>
    <button class="text-white hover:text-green-100 close-popup ml-2">
      <span class="material-icons text-sm">close</span>
    </button>
  </div>
`;
document.body.appendChild(popup);
setTimeout(() => {
  if (popup.parentNode) {
    popup.style.transform = 'translateX(100%)';
    setTimeout(() => popup.remove(), 300);
  }
}, 4000);
popup.querySelector('.close-popup').addEventListener('click', () => {
  popup.style.transform = 'translateX(100%)';
  setTimeout(() => popup.remove(), 300);
});
}

/**
 * Shows a temporary error popup.
 * @param {string} message The error message to display.
 */
window.showErrorPopup = function(message) {
const popup = document.createElement('div');
popup.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-[9999] transform transition-transform duration-300 translate-x-0';
popup.innerHTML = `
  <div class="flex items-center space-x-3">
    <span class="material-icons text-white">error</span>
    <span class="font-medium">${message}</span>
    <button class="text-white hover:text-red-100 close-popup ml-2">
      <span class="material-icons text-sm">close</span>
    </button>
  </div>
`;
document.body.appendChild(popup);
setTimeout(() => {
  if (popup.parentNode) {
    popup.style.transform = 'translateX(100%)';
    setTimeout(() => popup.remove(), 300);
  }
}, 4000);
popup.querySelector('.close-popup').addEventListener('click', () => {
  popup.style.transform = 'translateX(100%)';
  setTimeout(() => popup.remove(), 300);
});
}

/**
 * Sets up toggle and click-outside-to-close logic for a dropdown.
 * @param {string} buttonId The ID of the trigger button.
 * @param {string} popupId The ID of the popup/dropdown element.
 */
window.setupDropdownToggle = function(buttonId, popupId) {
const button = document.getElementById(buttonId);
const popup = document.getElementById(popupId);
if (!button || !popup) return;
button.addEventListener("click", (e) => {
  e.stopPropagation();
  popup.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!popup.contains(e.target) && !button.contains(e.target)) {
    popup.classList.add("hidden");
  }
});
};

// ==========================
// UNIFIED MODAL SYSTEM FOR REPORTS & OUTAGES (v6)
// ==========================

/**
 * Unified function to show update modal for both Reports and Outages
 * @param {Array} itemIds - Array of item IDs to update
 * @param {string} context - 'reports' or 'outages'
 * @param {Object} options - Additional options like currentFeederId, currentBarangay, manualCreation
 */
window.showUpdateModal = async function(itemIds, context, options = {}) {
  
// =================================================================
// ✅ FIX 1: Allow empty array IF manualCreation is true
// =================================================================
if ((!Array.isArray(itemIds) || itemIds.length === 0) && !options.manualCreation) {
  console.error('No item IDs provided to showUpdateModal');
  return;
}
// =================================================================

const isBulk = itemIds.length > 1;
const dispatchTeams = [
  { id: 'alpha', name: 'Team Alpha' },
  { id: 'beta', name: 'Team Beta' },
  { id: 'gamma', name: 'Team Gamma' }
];

try {
  // Get data based on context with proper fallbacks
  let itemsData = [];
  let allAssociatedIds = [];
  let feederId = options.currentFeederId || null;
  let selectedBarangays = new Set();
  
  console.log(`showUpdateModal called with context: ${context}, itemIds:`, itemIds, 'options:', options);

  if (context === 'reports') {
    // For reports, we need to get pending items
    const pendingItems = window.getPendingItems ? window.getPendingItems() : [];
    console.log('Pending items found:', pendingItems.length);
    
    if (options.currentView === 'barangays') {
      // Barangay view - itemIds are barangay names
      itemsData = itemIds.map(barangayName => ({ barangay: barangayName }));
      selectedBarangays = new Set(itemIds);
      
      // Get all reports for these barangays to determine feeder
      const barangayReports = pendingItems.filter(r => itemIds.includes(r.barangay));
      console.log('Barangay reports found:', barangayReports.length);
      
      if (barangayReports.length > 0 && !feederId) {
        feederId = barangayReports[0].feeder;
        console.log('Feeder ID determined from barangay reports:', feederId);
      }
      
      allAssociatedIds = barangayReports.map(r => r.id);
    } else {
      // Individual reports view
      itemsData = pendingItems.filter(r => itemIds.includes(r.id));
      console.log('Individual reports data:', itemsData);
      
      allAssociatedIds = itemIds;
      
      // Get selected barangays and feeder from reports
      itemsData.forEach(item => {
        if (item.barangay) selectedBarangays.add(item.barangay);
        if (!feederId && item.feeder) {
          feederId = item.feeder;
        }
      });
    }
  } else if (context === 'outages') {
  if (!window.supabase) {
    console.error("Supabase client missing.");
    return;
  }

  // Only fetch if we actually have IDs (skip for manual creation)
  if (itemIds.length > 0) {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, announcement_images ( id, image_url )') 
        .in('id', itemIds);

      if (error) {
        console.error("Failed to load announcement data:", error);
        window.showErrorPopup("Failed to load outage details.");
        return;
      }

      // Map data to create the `images` array the modal expects
      itemsData = data.map(item => {
        // Get URLs from the new related table
        const newImageUrls = item.announcement_images 
          ? item.announcement_images.map(img => img.image_url) 
          : [];
        
        // Fallback for any URLs still in the old 'pictures' or 'picture' columns
        const oldImageUrls = Array.isArray(item.pictures) ? item.pictures : [];
        const singleImageUrl = item.picture ? [item.picture] : [];
        
        // Combine all and remove duplicates
        const allImageUrls = [
          ...new Set([
            ...newImageUrls, 
            ...oldImageUrls, 
            ...singleImageUrl
          ])
        ];

        return {
          ...item,
          images: allImageUrls // This `images` property is used by the preview logic
        };
      });
  }

  allAssociatedIds = itemIds;

  itemsData.forEach(item => {
    if (item.areas_affected && Array.isArray(item.areas_affected)) {
      item.areas_affected.forEach(a => selectedBarangays.add(a));
    }
    if (!feederId && item.feeder_id) feederId = item.feeder_id;
  });
}


  // =================================================================
  // ✅ FIX 2: Skip "No data found" check if manualCreation
  // =================================================================
  if (itemsData.length === 0 && allAssociatedIds.length === 0 && !options.manualCreation) {
    console.warn('No data found for the provided IDs');
    window.showErrorPopup('No data found for the selected items');
    return;
  }

  const initialData = itemsData[0] || {};
  console.log('Initial data for modal:', initialData);
  console.log('Selected barangays:', Array.from(selectedBarangays));
  console.log('Feeder ID:', feederId);

  // DYNAMICALLY FETCH BARANGAYS FROM FEEDER_BARANGAYS TABLE
  let allBarangaysInFeeder = [];
  let feederBarangaysError = null;

  if (feederId && window.supabase) {
    try {
      console.log(`Fetching barangays for feeder ${feederId}...`);
      
      const { data: feederBarangays, error } = await supabase
        .from('feeder_barangays')
        .select(`
          barangay_id,
          barangays (
            id,
            name
          )
        `)
        .eq('feeder_id', parseInt(feederId));

      if (error) {
        feederBarangaysError = error;
        console.error('Error fetching feeder barangays:', error);
      } else {
        console.log(`Found ${feederBarangays?.length || 0} barangay relationships for feeder ${feederId}`);
        
        if (feederBarangays && feederBarangays.length > 0) {
          allBarangaysInFeeder = feederBarangays
            .map(fb => {
              if (!fb.barangays) {
                console.warn('Missing barangay data for barangay_id:', fb.barangay_id);
                return null;
              }
              return fb.barangays.name;
            })
            .filter(Boolean)
            .sort();
          
          console.log(`Processed ${allBarangaysInFeeder.length} barangay names:`, allBarangaysInFeeder);
        } else {
          console.warn(`No barangays found in feeder_barangays for feeder ${feederId}`);
        }
      }
    } catch (error) {
      feederBarangaysError = error;
      console.error('Exception fetching feeder barangays:', error);
    }
  }

  // If no barangays found from feeder_barangays, try alternative approaches
  if (allBarangaysInFeeder.length === 0) {
    console.log('Trying fallback methods to get barangays...');

    // Method 1: Use selected barangays from the data
    if (selectedBarangays.size > 0) {
      allBarangaysInFeeder = Array.from(selectedBarangays).sort();
      console.log(`Using selected barangays as fallback:`, allBarangaysInFeeder);
    }
    // Method 2: Get from reports data for this feeder
    else if (context === 'reports' && feederId) {
      const reportsInFeeder = (window.mockAllReports || []).filter(r => r.feeder === feederId);
      allBarangaysInFeeder = [...new Set(reportsInFeeder.map(r => r.barangay).filter(Boolean))].sort();
      console.log(`Found ${allBarangaysInFeeder.length} barangays from reports data:`, allBarangaysInFeeder);
    }
    // Method 3: Get from barangays table directly
    else if (window.supabase) {
      try {
        const { data: allBarangays, error } = await supabase
          .from('barangays')
          .select('id, name')
          .order('name');
        
        if (!error && allBarangays) {
          allBarangaysInFeeder = allBarangays.map(b => b.name).sort();
          console.log(`Showing all barangays as fallback:`, allBarangaysInFeeder);
        }
      } catch (error) {
        console.error('Error fetching all barangays:', error);
      }
    }
  }

  // Final fallback - if still no barangays, create a default list
  if (allBarangaysInFeeder.length === 0) {
    console.warn('No barangays found through any method, using default list');
    allBarangaysInFeeder = ['Barangay 1', 'Barangay 2', 'Barangay 3']; // Default fallback
    if (feederBarangaysError) {
      console.error('Original feeder_barangays error:', feederBarangaysError);
    }
  }

  // Generate area buttons + info
  let areaButtonsHTML = '';
  let areaInfoHTML = '';

  if (allBarangaysInFeeder.length > 0) {
    areaInfoHTML = `Feeder ${feederId || 'N/A'} - ${allBarangaysInFeeder.length} barangays`;

    areaButtonsHTML = allBarangaysInFeeder.map(barangay => {
      const isSelected = selectedBarangays.has(barangay); // ✅ auto-select
      return `
        <button type="button"
          class="area-toggle-btn px-3 py-1.5 rounded-full text-sm font-medium transition
          ${isSelected
            ? 'bg-blue-600 text-white hover:bg-blue-700'
            : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
          }"
          data-barangay="${barangay}">
          ${barangay}
        </button>`;
    }).join('');

  } else {
    areaInfoHTML = 'No barangays configured';
    areaButtonsHTML = `
      <div class="text-center p-4">
        <p class="text-red-500 text-sm mb-2">No barangays found for this feeder</p>
        <p class="text-gray-500 text-xs">
          Please check feeder_barangays relationships.
        </p>
      </div>
    `;
  }


  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4';
  modal.id = 'updateModal';
  
  modal.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
      <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
          ${isBulk ? 'Bulk Update / Announce' : 'Update ' + (context === 'reports' ? 'Report' : 'Outage') + ' / Announce'}
        </h3>
        <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal">
          <span class="material-icons">close</span>
        </button>
      </div>

      <form id="updateForm" class="p-6 space-y-4 overflow-y-auto">
        ${feederId ? `
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <label class="block text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Feeder Group</label>
            <p class="text-lg font-semibold text-blue-600 dark:text-blue-400">Feeder ${feederId}</p>
            <p class="text-xs text-blue-600 dark:text-blue-300 mt-1">
              ${allBarangaysInFeeder.length} barangays in this feeder group
            </p>
          </div>
        ` : ''}

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Outage Type</label>
          <div class="flex space-x-4">
            <label class="inline-flex items-center cursor-pointer">
              <input type="radio" name="outageType" value="scheduled" class="form-radio text-blue-600" 
                      ${initialData.type === 'scheduled' ? 'checked' : ''}>
              <span class="ml-2 text-gray-700 dark:text-gray-300">Scheduled</span>
            </label>
            <label class="inline-flex items-center cursor-pointer">
              <input type="radio" name="outageType" value="unscheduled" class="form-radio text-blue-600" 
                      ${initialData.type !== 'scheduled' ? 'checked' : true}>
              <span class="ml-2 text-gray-700 dark:text-gray-300">Unscheduled</span>
            </label>
          </div>
        </div>

        <div id="scheduledDateContainer" class="hidden transition-all duration-300">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Scheduled Date & Time</label>
          <input type="datetime-local" id="scheduledAtInput" 
                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700"
                value="${initialData.scheduled_at ? new Date(initialData.scheduled_at).toISOString().slice(0, 16) : ''}">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cause</label>
          <input type="text" id="causeInput" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                  value="${initialData.cause || ''}" placeholder="Enter cause (e.g., 'Transformer Failure')">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location (Text)</label>
          <input type="text" id="locationInput" 
                class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                value="${initialData.location || ''}" 
                placeholder="Ex: Purok 5 near Barangay Hall">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload Pictures</label>
          <input type="file" id="modalFileInput" multiple accept="image/*" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-200 dark:hover:file:bg-blue-800">
          <div id="imagePreview" class="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2 ${initialData.images?.length ? '' : 'hidden'}"></div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Affected Areas 
            <span class="text-blue-600 dark:text-blue-400">(${areaInfoHTML})</span>
          </label>
          
          ${allBarangaysInFeeder.length > 0 ? `
            <div class="flex items-center mb-3">
              <input type="checkbox" 
                    id="selectAllBarangays" 
                    class="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500">
              <label for="selectAllBarangays" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Select All ${allBarangaysInFeeder.length} Barangays
              </label>
            </div>
          ` : ''}

          <div id="areasButtonContainer" class="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-h-[40px] max-h-32 overflow-y-auto">
            ${areaButtonsHTML}
          </div>
        </div>

        <div>
          <label for="statusSelect" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Set Status</label>
          <select id="statusSelect" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
            <option value="Reported" ${initialData.status === 'Reported' ? 'selected' : (context === 'reports' ? 'selected' : '')}>Reported</option>
            <option value="Ongoing" ${initialData.status === 'Ongoing' ? 'selected' : ''}>Ongoing</option>
            <option value="Completed" ${initialData.status === 'Completed' ? 'selected' : ''}>Completed</option>
          </select>
        </div>

        <div id="dispatchTeamSection" class="${initialData.status === 'Ongoing' ? '' : 'hidden'}">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Dispatch Team</label>
          <select id="dispatchTeamSelect" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700">
            <option value="">None</option>
            ${dispatchTeams.map(team => 
              `<option value="${team.id}" ${initialData.dispatch_team === team.id ? 'selected' : ''}>${team.name}</option>`
            ).join('')}
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
          <textarea id="modalDescription" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                    rows="3" placeholder="Enter outage description">${initialData.description || ''}</textarea>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Estimated Time of Restoration (ETA)</label>
          <input type="datetime-local" id="modalEta" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                  value="${initialData.estimated_restoration_at ? new Date(initialData.estimated_restoration_at).toISOString().slice(0, 16) : ''}">
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Map Coordinates</label>

        <div class="flex items-center space-x-2 mb-2">
            <input type="checkbox" id="enableCoordinates" class="h-4 w-4 text-blue-600 border-gray-300 rounded">
            <label for="enableCoordinates" class="text-sm text-gray-700 dark:text-gray-300">
            Specify custom outage location on map
            </label>
        </div>

        <input type="text" id="coordinateInput"
              placeholder="e.g., 16.414102, 120.595055"
              class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 hidden">
      </div>
      </form>

      <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button 
            type="submit" 
            form="updateForm" 
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition"
            id="modalUpdateBtn"
            ${initialData.status === 'Completed' && context === 'outages' ? 'disabled style="background-color: #d1d5db; color: #6b7280; cursor: not-allowed; border: none;"' : ''}
          >
            ${isBulk ? 'Post Bulk Announcement' : 'Update Announcement'}
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // --- Modal Event Listeners ---
  modal.querySelectorAll('.close-modal').forEach(btn => 
    btn.addEventListener('click', () => modal.remove())
  );

  // --- NEW: Schedule Date Logic ---
  const scheduledDateContainer = modal.querySelector('#scheduledDateContainer');
  const radioButtons = modal.querySelectorAll('input[name="outageType"]');

  // Function to toggle visibility based on selected radio
  const toggleScheduledInput = () => {
    const selected = modal.querySelector('input[name="outageType"]:checked').value;
    if (selected === 'scheduled') {
      scheduledDateContainer.classList.remove('hidden');
    } else {
      scheduledDateContainer.classList.add('hidden');
    }
  };

  // Initial check
  toggleScheduledInput();

  // Add listeners
  radioButtons.forEach(radio => {
    radio.addEventListener('change', toggleScheduledInput);
  });

  // Coordinate input toggle
  const enableCoordinates = modal.querySelector('#enableCoordinates');
  const coordinateInput = modal.querySelector('#coordinateInput');

  // ✅ Pre-fill coordinates if existing
  if (initialData.latitude && initialData.longitude) {
    enableCoordinates.checked = true;
    coordinateInput.classList.remove('hidden');
    coordinateInput.value = `${initialData.latitude}, ${initialData.longitude}`;
  }

  enableCoordinates.addEventListener('change', () => {
    coordinateInput.classList.toggle('hidden', !enableCoordinates.checked);
  });

  // Area toggle buttons with select all functionality
  const areaButtons = modal.querySelectorAll('.area-toggle-btn');
  const selectAllCheckbox = modal.querySelector('#selectAllBarangays');
  let selectedAreas = new Set(selectedBarangays);

  if (selectAllCheckbox) {
  selectAllCheckbox.addEventListener('change', () => {
    const isChecked = selectAllCheckbox.checked;
    areaButtons.forEach(btn => {
      const barangay = btn.dataset.barangay;
      if (isChecked) {
        selectedAreas.add(barangay);
        btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
        btn.classList.remove('bg-gray-200','text-gray-800','hover:bg-gray-300','dark:bg-gray-700','dark:text-gray-200','dark:hover:bg-gray-600');
      } else {
        selectedAreas.delete(barangay);
        btn.classList.remove('bg-blue-600','text-white','hover:bg-blue-700');
        btn.classList.add('bg-gray-200','text-gray-800','hover:bg-gray-300','dark:bg-gray-700','dark:text-gray-200','dark:hover:bg-gray-600');
      }
    });
  });
}

  areaButtons.forEach(btn => {
  const barangay = btn.dataset.barangay;

  // Ensure visual state matches selected set on load
  if (selectedAreas.has(barangay)) {
    btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
    btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:text-gray-200', 'dark:hover:bg-gray-600');
  }

  btn.addEventListener('click', () => {
    if (selectedAreas.has(barangay)) {
      selectedAreas.delete(barangay);
      btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
      btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:text-gray-200', 'dark:hover:bg-gray-600');
    } else {
      selectedAreas.add(barangay);
      btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
      btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:text-gray-200', 'dark:hover:bg-gray-600');
    }

    // Update select-all checkbox state
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = selectedAreas.size === areaButtons.length;
      selectAllCheckbox.indeterminate = selectedAreas.size > 0 && selectedAreas.size < areaButtons.length;
    }
  });
});


  // Status change handler
  const statusSelect = modal.querySelector('#statusSelect');
  const dispatchSection = modal.querySelector('#dispatchTeamSection');
  statusSelect.addEventListener('change', () => 
    dispatchSection.classList.toggle('hidden', statusSelect.value !== 'Ongoing')
  );

  // Image preview
  const fileInput = modal.querySelector('#modalFileInput');
  const imagePreview = modal.querySelector('#imagePreview');
  fileInput.addEventListener('change', (e) => {
    imagePreview.innerHTML = '';
    imagePreview.classList.toggle('hidden', e.target.files.length === 0);
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.className = 'w-full h-16 object-cover rounded';
        imagePreview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });

  // Pre-populate image preview if existing images
  // This works because `initialData.images` was set correctly
  // by the logic in MODIFICATION 1
  if (initialData.images && initialData.images.length > 0) {
    initialData.images.forEach(imgSrc => {
      const img = document.createElement('img');
      img.src = imgSrc;
      img.className = 'w-full h-16 object-cover rounded';
      imagePreview.appendChild(img);
    });
  }

  // Form submission
  modal.querySelector('#updateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = modal.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Posting...';

    try {
        const files = modal.querySelector('#modalFileInput').files;
        const newImageUrls = []; 
        let isBulk = itemIds.length > 1; // Get isBulk status

        if (files.length > 0) {
            console.log(`Uploading ${files.length} images...`);
            for (const file of files) {
                // Use a 'public' folder for simplicity, or structure as needed
                const fileName = `public/${Date.now()}-${file.name}`;
                
                if (!window.supabase) throw new Error("Supabase client not found.");

                const { data, error } = await supabase.storage
                    .from('announcements_images') // Bucket name for announcement images
                    .upload(fileName, file);
                
                if (error) {
                    throw new Error(`Image upload failed: ${error.message}`);
                }
                
                // Get the public URL for the uploaded file
                const { data: publicUrlData } = supabase.storage
                    .from('announcements_images')
                    .getPublicUrl(data.path);
                
                newImageUrls.push(publicUrlData.publicUrl);
            }
            console.log('New Image URLs:', newImageUrls);
        }

        // Merge with existing images (if any)
        // This works because `initialData.images` was set correctly
        const existingImageUrls = initialData.images || [];
        const allImageUrls = [...existingImageUrls, ...newImageUrls];

        // ✅ Parse coordinates if toggle enabled
        const coordText = coordinateInput && !coordinateInput.classList.contains('hidden')
          ? coordinateInput.value.trim()
          : null;

        let latitude = null;
        let longitude = null;

        if (coordText && coordText.includes(',')) {
          const [latStr, lngStr] = coordText.split(',').map(x => x.trim());
          latitude = parseFloat(latStr);
          longitude = parseFloat(lngStr);
        }

        const formData = {
          outageType: modal.querySelector('input[name="outageType"]:checked').value,
          cause: modal.querySelector('#causeInput').value,
          location: modal.querySelector('#locationInput').value,
          status: modal.querySelector('#statusSelect').value,
          description: modal.querySelector('#modalDescription').value,
          eta: modal.querySelector('#modalEta').value,
          scheduled_at: modal.querySelector('#scheduledAtInput').value, // ✅ NEW
          // dispatchTeam: modal.querySelector('#dispatchTeamSelect')?.value || null,
          affectedAreas: Array.from(selectedAreas),
          imageUrls: allImageUrls, // This is the *complete* set of URLs
          latitude,    
          longitude    
        };


        console.log('Form submission data:', formData);

        // Call context-specific update handler
        if (context === 'reports') {
            await handleReportsUpdate(allAssociatedIds, formData, feederId);
        } else if (context === 'outages') {
            await handleOutagesUpdate(allAssociatedIds, formData, feederId);
        }

        modal.remove();

    } catch (error) {
        console.error('Error during submission:', error);
        window.showErrorPopup(error.message);
        submitButton.disabled = false;
        // Reset button text
        let isBulk = itemIds.length > 1; 
        submitButton.textContent = isBulk ? 'Post Bulk Announcement' : 'Update Announcement';
    }
  });

} catch (error) {
  console.error('Error in showUpdateModal:', error);
  window.showErrorPopup('Failed to load announcement data: ' + error.message);
}
};

/**
 * Handle reports update
 */
/**
 * Handle reports update - converts reports to announcements
 * @param {Array} reportIds - Array of report IDs to update
 * @param {Object} formData - Form data from modal
 * @param {number} feederId - Feeder ID
 */
async function handleReportsUpdate(reportIds, formData, feederId) {
  console.log(`Updating ${reportIds.length} reports (converting to announcements):`, formData);

  if (!window.supabase) {
    console.error('Supabase client not found.');
    window.showErrorPopup('Database connection failed.');
    return;
  }

  // =================================================================
  // ✅ MODIFICATION 2: Remove 'pictures' from announcementData
  // =================================================================
  const announcementData = {
    feeder_id: feederId ? parseInt(feederId) : null,
    type: formData.outageType,
    cause: formData.cause || null,
    location: formData.location || null,
    // pictures: formData.imageUrls.length > 0 ? formData.imageUrls : null, // <-- REMOVED
    areas_affected: formData.affectedAreas.length > 0 ? formData.affectedAreas : null,
    barangay: formData.affectedAreas.length > 0 ? formData.affectedAreas[0] : null,
    status: formData.status,
    description: formData.description || null,
    estimated_restoration_at: formData.eta || null,
    scheduled_at: formData.scheduled_at || null, // ✅ NEW: Save scheduled date
    latitude: formData.latitude,
    longitude: formData.longitude,
    // dispatch_team: formData.dispatchTeam !== 'None' ? formData.dispatchTeam : null,
    created_at: new Date().toISOString()
  };

  console.log('Creating announcement from reports:', announcementData);

  try {
    // 1. Insert new announcement
    const { data, error } = await supabase
      .from('announcements')
      .insert([announcementData])
      .select(); // Must .select() to get the ID of the new row

    if (error) {
      throw error;
    }

    const newAnnouncement = data[0]; // Get the newly created announcement
    console.log('Announcement created successfully:', newAnnouncement);

    // 2. NEW LOGIC: Insert images into announcement_images table
    if (formData.imageUrls && formData.imageUrls.length > 0) {
      const imageInserts = formData.imageUrls.map(url => ({
        announcement_id: newAnnouncement.id,
        image_url: url
        // We assume `image_url` is the correct column,
        // not `pictures` in the `announcement_images` table
      }));

      const { error: imageError } = await supabase
        .from('announcement_images')
        .insert(imageInserts);

      if (imageError) {
        // Log the error but don't fail the whole operation,
        // as the announcement itself was created.
        console.error('Error inserting announcement images:', imageError);
        window.showErrorPopup('Announcement created, but failed to save images.');
      }
    }
    // =================================================================
    // ✅ END MODIFICATION 2
    // =================================================================

    // 3. Now update the original reports to mark them as processed/announced
    if (reportIds.length > 0) {
      const { error: updateError } = await supabase
        .from('reports')
        .update({ 
          status: 'Announced',
          announced_at: new Date().toISOString()
        })
        .in('id', reportIds);

      if (updateError) {
        console.error('Error updating report status:', updateError);
        // Don't throw - announcement was created successfully
      }
    }

    window.showSuccessPopup("Reports converted to announcement successfully!");

    // Refresh reports list UI
    if (typeof window.applyFiltersAndRender === 'function') {
      window.applyFiltersAndRender();
    }

    // Refresh MAP if present
    if (typeof window.loadAnnouncementsToMap === "function") {
      window.loadAnnouncementsToMap();
    }
  } catch (error) {
    console.error('Error creating announcement from reports:', error.message);
    window.showErrorPopup(`Error creating announcement: ${error.message}`);
  }
}

/**
 * Handle outages updates
 */
async function handleOutagesUpdate(outageIds, formData, feederId) {
  console.log(`Updating ${outageIds.length} outages/announcements:`, formData);

  if (!window.supabase) {
      console.error('Supabase client not found.');
      window.showErrorPopup('Database connection failed.');
      return;
  }

  // =================================================================
  // ✅ MODIFICATION 3: Remove 'pictures' and add image sync logic
  // =================================================================

  // 1. Map form data for the 'announcements' table (NO images)
  const announcementData = {
      feeder_id: feederId ? parseInt(feederId) : null,
      type: formData.outageType,
      cause: formData.cause || null,
      location: formData.location || null,
      // pictures: formData.imageUrls.length > 0 ? formData.imageUrls : null, // <-- REMOVED
      areas_affected: formData.affectedAreas.length > 0 ? formData.affectedAreas : null,
      barangay: formData.affectedAreas.length > 0 ? formData.affectedAreas[0] : null,
      status: formData.status,
      description: formData.description || null,
      estimated_restoration_at: formData.eta || null,
      scheduled_at: formData.scheduled_at || null, // ✅ NEW: Save scheduled date
      latitude: formData.latitude,  
      longitude: formData.longitude, 
      updated_at: new Date().toISOString() // Manually set updated_at
  };

  console.log('Updating announcements (main data):', announcementData);

  try {
      // 2. Update the main announcement details
      const { data, error } = await supabase
          .from('announcements')
          .update(announcementData)
          .in('id', outageIds); // Apply update to all selected IDs

      if (error) {
          throw error;
      }
      
      console.log('Supabase announcement update success:', data);
      
      // --- NEW LOGIC: Sync announcement_images ---
      
      // 3. Delete all old images for these announcements
      // This ensures removed images are gone
      const { error: deleteError } = await supabase
          .from('announcement_images')
          .delete()
          .in('announcement_id', outageIds);
      
      if (deleteError) {
          console.error('Error clearing old announcement images:', deleteError);
          // Don't throw, just warn. Proceed to insert new ones.
      }

      // 4. Prepare new image rows to insert
      // formData.imageUrls contains the *complete* list of images
      if (formData.imageUrls && formData.imageUrls.length > 0) {
          const imageInserts = [];
          for (const id of outageIds) { // Loop over each announcement being updated
              for (const url of formData.imageUrls) { // Add all images for it
                  imageInserts.push({
                      announcement_id: id,
                      image_url: url
                  });
              }
          }

          // 5. Insert all new images in one batch
          if (imageInserts.length > 0) {
              const { error: insertError } = await supabase
                  .from('announcement_images')
                  .insert(imageInserts);
              
              if (insertError) {
                  console.error('Error inserting new announcement images:', insertError);
                  // Log and show a partial success
                  window.showErrorPopup("Outage updated, but failed to save images.");
              }
          }
      }
      // --- END NEW LOGIC ---
      // =================================================================
      // ✅ END MODIFICATION 3
      // =================================================================

      window.showSuccessPopup("Outage updated successfully!");

      // Refresh outages list UI
      if (typeof window.applyFiltersAndRender === 'function') {
          window.applyFiltersAndRender();
      }

      // ✅ Also refresh MAP if present
      if (typeof window.loadAnnouncementsToMap === "function") {
          window.loadAnnouncementsToMap();
      }
  } catch (error) {
      console.error('Error updating announcement:', error.message);
      window.showErrorPopup(`Error updating announcement: ${error.message}`);
  }
}

// --- MAIN SCRIPT LOGIC ---

document.addEventListener("DOMContentLoaded", () => {
  console.log("shared.js v10 (Schema Update): DOMContentLoaded");

  // --- Universal Filter Callback (from sharedog.js) ---
  const callPageFilter = () => {
      if (typeof window.applyFilters === "function") {
          window.applyFilters();
      } else {
          console.warn("No page-specific filter function found (window.applyFilters).");
      }
  };

  // --- Sidebar Highlighting (from sharedog.js) ---
  try {
    const links = document.querySelectorAll(".sidebar-link");
    const pathSegments = window.location.pathname.split('/');
    const current = (pathSegments.pop() || 'index.html').toLowerCase();

    links.forEach(link => {
      const href = link.getAttribute("href")?.toLowerCase() || '';
      const isActive = (href === current) || (href === 'index.html' && current === '');

      if (isActive) {
        link.classList.add("bg-primary", "text-white");
        link.classList.remove("text-gray-600", "dark:text-gray-300", "hover:bg-gray-200", "dark:hover:bg-gray-700");
      } else {
        link.classList.add("text-gray-600", "dark:text-gray-300");
        link.classList.remove("bg-primary", "text-white");
        link.addEventListener("mouseenter", () => link.classList.add("bg-gray-200", "dark:bg-gray-700"));
        link.addEventListener("mouseleave", () => link.classList.remove("bg-gray-200", "dark:bg-gray-700"));
      }
    });
  } catch (error) {
      console.error("shared.js: Error during sidebar highlighting:", error);
  }

  // --- Date Dropdown Logic (from sharedog.js) ---
  const dateBtn = document.getElementById("dateDropdownBtn");
  if (dateBtn) {
    try {
        const cloneTemplate = (tplId, targetId) => {
          const tpl = document.getElementById(tplId);
          const target = document.getElementById(targetId);
          if (tpl && target && !target.hasChildNodes()) {
              target.appendChild(tpl.content.cloneNode(true));
          }
        };
        cloneTemplate('calendarIconTemplate', 'calendarIcon');
        cloneTemplate('arrowDownTemplate', 'arrowIcon');

        const dateDropdown = document.getElementById("calendarDropdown");
        const dateLabel = document.getElementById("selectedDate");
        const dateInput = document.getElementById("calendarInput");
        const applyDate = document.getElementById("applyDateBtn");

        window.setupDropdownToggle("dateDropdownBtn", "calendarDropdown");

        if (dateDropdown && dateLabel && dateInput && applyDate) {
          applyDate.addEventListener("click", () => {
            if (!dateInput.value) return;
            const formatted = new Date(dateInput.value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            dateLabel.textContent = formatted;
            dateDropdown.classList.add("hidden");
            if (typeof window.filterOutages === "function") window.filterOutages();
            else if (typeof window.filterMarkers === "function") window.filterMarkers();
            else console.warn("No page-specific DATE filter function found (filterOutages or filterMarkers).");
          });

          dateLabel.addEventListener("contextmenu", e => {
            e.preventDefault();
            dateInput.value = '';
            dateLabel.textContent = 'Select Date';
            if (typeof window.filterOutages === "function") window.filterOutages();
            else if (typeof window.filterMarkers === "function") window.filterMarkers();
          });
        }
    } catch (error) {
        console.error("shared.js: Error setting up date filter:", error);
    }
  }

  // --- Feeder Filter UI Logic (from sharedog.js) ---
const feederBtn = document.getElementById("feederFilterBtn");
const feederPopup = document.getElementById("feederPopup");

if (feederBtn && feederPopup) {
    // This part is correct and handles opening/closing
    window.setupDropdownToggle("feederFilterBtn", "feederPopup");

    const feederClearAll = document.getElementById("feederClearAll");
    const feederSelectAll = document.getElementById("feederSelectAll");

    /**
     * Helper function to set the visual state of all buttons.
     * This function now queries for the buttons *every time it runs*,
     * so it works on the currently visible buttons.
     */
    const setTogglesState = (select) => {
        // Find the buttons *now*, not on page load
        const feederToggles = feederPopup.querySelectorAll(".feeder-toggle");
        
        feederToggles.forEach((btn) => {
            if (select) {
                btn.classList.add("bg-blue-500", "text-white");
                btn.classList.remove("bg-gray-200", "dark:bg-gray-700");
            } else {
                btn.classList.remove("bg-blue-500", "text-white");
                btn.classList.add("bg-gray-200", "dark:bg-gray-700");
            }
        });
        callPageFilter(); // Call the page-specific filter function
    };

    // --- NEW: Event Delegation ---
    // Listen for all clicks on the popup container
    feederPopup.addEventListener("click", (e) => {
        
        // Check if the clicked item (e.target) is a feeder-toggle button
        if (e.target.classList.contains("feeder-toggle")) {
            // It is! Toggle its classes.
            e.target.classList.toggle("bg-blue-500");
            e.target.classList.toggle("text-white");
            e.target.classList.toggle("bg-gray-200");
            e.target.classList.toggle("dark:bg-gray-700");
            callPageFilter(); // Call the page-specific filter function
        }
    });

    // These buttons exist on page load, so their listeners are fine.
    // They will now work because setTogglesState() finds buttons dynamically.
    feederClearAll?.addEventListener("click", () => setTogglesState(false));
    feederSelectAll?.addEventListener("click", () => setTogglesState(true));
}

 // --- Search Input Logic (from sharedog.js) ---
  const searchInput = document.getElementById("locationSearch");
  if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(callPageFilter, 300);
      });
  }

  // =================================================================
  // FIXED PROFILE LOGIC (Self-Contained)
  // =================================================================

  // --- 1. Define the Sync Function (Internal Helper) ---
  async function internalSyncUserProfile() {
      if (!window.supabase) return;
      
      // Get active session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // UI Elements
      const headerName = document.getElementById("adminName");
      const headerImg = document.getElementById("adminProfile");
      const dropdownEmail = document.querySelector("#profileDropdown p.text-gray-500");
      const settingsNameInput = document.getElementById('nicknameInput');

      if (error || !session) {
          if (headerName) headerName.textContent = "GUEST";
          return;
      }

      const user = session.user;
      const meta = user.user_metadata || {};
      
      // Use Metadata Name OR Email username
      const displayName = meta.display_name || user.email.split('@')[0];
      
      // Update Header
      if (headerName) headerName.textContent = displayName.toUpperCase();
      if (headerImg && meta.avatar_url) headerImg.src = meta.avatar_url;
      if (dropdownEmail) dropdownEmail.textContent = user.email;
      
      // Update Settings Input (if modal is open)
      if (settingsNameInput) settingsNameInput.value = displayName;
  }

  // --- 2. Run Sync Immediately ---
  internalSyncUserProfile();

  // --- 3. Modal & Dropdown Logic ---
  window.setupDropdownToggle("profileTrigger", "profileDropdown");

  const openProfileModalBtn = document.getElementById('openProfileModalBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const cancelUpdateBtn = document.getElementById('cancelUpdateBtn');
  const profileUpdateForm = document.getElementById('profileUpdateForm');

  const openModal = () => {
      if (profileModal) {
          profileModal.classList.remove('hidden');
          profileModal.classList.add('flex');
          internalSyncUserProfile(); // Refresh data when opening
          const dropdown = document.getElementById('profileDropdown');
          if (dropdown) dropdown.classList.add('hidden');
      }
  };

  const closeModal = () => {
      if (profileModal) {
          profileModal.classList.add('hidden');
          profileModal.classList.remove('flex');
      }
  };

  // Attach Listeners (Check if elements exist first to avoid errors)
  if (openProfileModalBtn) openProfileModalBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', closeModal);
  if (cancelUpdateBtn) cancelUpdateBtn.addEventListener('click', closeModal);

  // --- 4. Logout Logic ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (window.supabase) {
              await supabase.auth.signOut();
              localStorage.clear();
              window.location.href = 'login.html';
          }
      });
  }

  // --- 5. Update Profile Submission ---
  if (profileUpdateForm) {
      profileUpdateForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const nameInput = document.getElementById('nicknameInput');
          const fileInput = document.getElementById('profilePictureInput');
          const saveBtn = document.getElementById('saveProfileBtn');
          
          if (!nameInput) return;

          // Visual Feedback
          const originalBtnText = saveBtn ? saveBtn.textContent : 'Save';
          if (saveBtn) { 
              saveBtn.textContent = 'Saving...'; 
              saveBtn.disabled = true; 
          }

          try {
              const updates = {
                  display_name: nameInput.value
              };

              // Helper to push updates to Supabase
              const performUserUpdate = async (data) => {
                  const { error } = await supabase.auth.updateUser({ data: data });
                  if (error) throw error;
                  
                  window.showSuccessPopup("Profile updated successfully!");
                  await internalSyncUserProfile(); // Update UI
                  closeModal();
              };

              // Handle Image (Base64)
              if (fileInput && fileInput.files && fileInput.files[0]) {
                  const file = fileInput.files[0];
                  const reader = new FileReader();
                  reader.onload = async function(ev) {
                      updates.avatar_url = ev.target.result;
                      await performUserUpdate(updates);
                  };
                  reader.readAsDataURL(file);
              } else {
                  // Text only update
                  await performUserUpdate(updates);
              }

          } catch (err) {
              console.error(err);
              window.showErrorPopup("Failed to update profile.");
          } finally {
              if (saveBtn) { 
                  saveBtn.textContent = originalBtnText; 
                  saveBtn.disabled = false; 
              }
          }
      });
  }
  // =================================================================
  // END FIXED PROFILE LOGIC
  // =================================================================

  // --- Service Worker (from sharedog.js) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registered successfully:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }

  // ============================================================
// NEW: AUTH SYNC HELPER (Paste at the very bottom of shared.js)
// ============================================================
async function syncUserProfile() {
  if (!window.supabase) return;

  // 1. Get the active Supabase session
  const { data: { session }, error } = await supabase.auth.getSession();

  // 2. Elements to update
  const headerName = document.getElementById("adminName");
  const headerImg = document.getElementById("adminProfile");
  const dropdownEmail = document.querySelector("#profileDropdown p.text-gray-500"); 
  const settingsNameInput = document.getElementById('nicknameInput'); // Inside modal/settings

  if (error || !session) {
      console.log("No active session found.");
      if(headerName) headerName.textContent = "GUEST";
      return;
  }

  const user = session.user;
  const meta = user.user_metadata || {};

  // 3. Update UI with REAL data from database
  const displayName = meta.display_name || user.email.split('@')[0];
  const avatarUrl = meta.avatar_url;

  // Update Header Name
  if (headerName) headerName.textContent = displayName.toUpperCase();
  
  // Update Dropdown Email (if exists)
  if (dropdownEmail) dropdownEmail.textContent = user.email;

  // Update Header/Modal Profile Picture
  if (headerImg && avatarUrl) headerImg.src = avatarUrl;

  // Pre-fill Settings Inputs (if present on page)
  if (settingsNameInput) settingsNameInput.value = displayName;
}

}); // End DOMContentLoaded