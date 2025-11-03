// ==========================
// SHARED SCRIPT (v6 - Merged)
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
 * @param {Object} options - Additional options like currentFeederId, currentBarangay
 */
window.showUpdateModal = async function(itemIds, context, options = {}) {
if (!Array.isArray(itemIds) || itemIds.length === 0) {
  console.error('No item IDs provided to showUpdateModal');
  return;
}

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
    // For outages, get from mockOutages or global data
    const outagesData = window.mockOutages || [];
    console.log('Outages data available:', outagesData.length);
    
    itemsData = outagesData.filter(o => itemIds.includes(o.id));
    console.log('Filtered outages data:', itemsData);
    
    allAssociatedIds = itemIds;
    
    // Get selected barangays from outages
    itemsData.forEach(item => {
      if (item.affected_areas && Array.isArray(item.affected_areas)) {
        item.affected_areas.forEach(area => selectedBarangays.add(area));
      } else if (item.barangay) {
        selectedBarangays.add(item.barangay);
      }
    });
  }

  // If no items found, show error and return
  if (itemsData.length === 0 && allAssociatedIds.length === 0) {
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

  // Generate area buttons with better error handling
  let areaButtonsHTML = '';
  let areaInfoHTML = '';

  if (allBarangaysInFeeder.length > 0) {
    areaInfoHTML = `Feeder ${feederId || 'N/A'} - ${allBarangaysInFeeder.length} barangays`;
    areaButtonsHTML = allBarangaysInFeeder.map(barangay => {
      const isSelected = selectedBarangays.has(barangay);
      return `<button type="button" class="area-toggle-btn px-3 py-1.5 rounded-full text-sm font-medium transition ${
        isSelected
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }" data-barangay="${barangay}">${barangay}</button>`;
    }).join('');
  } else {
    areaInfoHTML = 'No barangays configured';
    areaButtonsHTML = `
      <div class="text-center p-4">
        <p class="text-red-500 text-sm mb-2">No barangays found for this feeder</p>
        <p class="text-gray-500 text-xs">
          Please check that:<br>
          1. The feeder_barangays table has data<br>
          2. Feeder ${feederId} exists in the table<br>
          3. Barangays are properly linked to feeders
        </p>
      </div>
    `;
  }

  // Create modal HTML
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
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
        <!-- Feeder Info Display -->
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
            <label class="inline-flex items-center">
              <input type="radio" name="outageType" value="scheduled" class="form-radio text-blue-600" 
                      ${initialData.type === 'scheduled' ? 'checked' : ''}>
              <span class="ml-2 text-gray-700 dark:text-gray-300">Scheduled</span>
            </label>
            <label class="inline-flex items-center">
              <input type="radio" name="outageType" value="unscheduled" class="form-radio text-blue-600" 
                      ${initialData.type !== 'scheduled' ? 'checked' : true}>
              <span class="ml-2 text-gray-700 dark:text-gray-300">Unscheduled</span>
            </label>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Cause</label>
          <input type="text" id="causeInput" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                  value="${initialData.cause || ''}" placeholder="Enter cause (e.g., 'Transformer Failure')">
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
          <input type="text" id="locationInput" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                  value="${initialData.barangay || initialData.title?.split(' - ')[1] || ''}" placeholder="Enter specific location">
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
          
          <!-- Select All Toggle -->
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
                  value="${initialData.eta ? new Date(initialData.eta).toISOString().slice(0, 16) : ''}">
        </div>
      </form>

      <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition close-modal">Cancel</button>
        <button type="submit" form="updateForm" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition">
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

  // Area toggle buttons with select all functionality
  const areaButtons = modal.querySelectorAll('.area-toggle-btn');
  const selectAllCheckbox = modal.querySelector('#selectAllBarangays');
  
  if (selectAllCheckbox && areaButtons.length > 0) {
    selectAllCheckbox.addEventListener('change', () => {
      const isChecked = selectAllCheckbox.checked;
      areaButtons.forEach(btn => {
        if (isChecked) {
          btn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700');
          btn.classList.remove('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:text-gray-200', 'dark:hover:bg-gray-600');
        } else {
          btn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700');
          btn.classList.add('bg-gray-200', 'text-gray-800', 'hover:bg-gray-300', 'dark:bg-gray-700', 'dark:text-gray-200', 'dark:hover:bg-gray-600');
        }
      });
    });
  }

  areaButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('bg-blue-600');
      btn.classList.toggle('text-white');
      btn.classList.toggle('hover:bg-blue-700');
      btn.classList.toggle('bg-gray-200');
      btn.classList.toggle('text-gray-800');
      btn.classList.toggle('hover:bg-gray-300');
      btn.classList.toggle('dark:bg-gray-700');
      btn.classList.toggle('dark:text-gray-200');
      btn.classList.toggle('dark:hover:bg-gray-600');
      
      // Update select all checkbox state
      if (selectAllCheckbox) {
        const allSelected = Array.from(areaButtons).every(btn => 
          btn.classList.contains('bg-blue-600')
        );
        const someSelected = Array.from(areaButtons).some(btn => 
          btn.classList.contains('bg-blue-600')
        );
        
        selectAllCheckbox.checked = allSelected;
        selectAllCheckbox.indeterminate = someSelected && !allSelected;
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
        const existingImageUrls = initialData.images || [];
        const allImageUrls = [...existingImageUrls, ...newImageUrls];

        const formData = {
            outageType: modal.querySelector('input[name="outageType"]:checked').value,
            cause: modal.querySelector('#causeInput').value,
            location: modal.querySelector('#locationInput').value,
            status: modal.querySelector('#statusSelect').value,
            description: modal.querySelector('#modalDescription').value,
            eta: modal.querySelector('#modalEta').value,
            dispatchTeam: modal.querySelector('#dispatchTeamSelect')?.value || null,
            affectedAreas: Array.from(modal.querySelectorAll('.area-toggle-btn.bg-blue-600'))
                .map(btn => btn.dataset.barangay),
            imageUrls: allImageUrls // Use the merged list
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
 * Handle reports update (mock implementation)
 */
async function handleReportsUpdate(reportIds, formData, feederId) {
  console.log(`Pushing new announcement for ${reportIds.length} reports:`, formData);

  if (!window.supabase) {
      console.error('Supabase client not found.');
      window.showErrorPopup('Database connection failed.');
      return;
  }

  // Map form data to the 'announcements' table schema
  const announcementData = {
      feeder_id: feederId ? parseInt(feederId) : null,
      report_ids: reportIds,
      type: formData.outageType,
      cause: formData.cause || null,
      location: formData.location || null,
      pictures: formData.imageUrls.length > 0 ? formData.imageUrls : null,
      areas_affected: formData.affectedAreas.length > 0 ? formData.affectedAreas : null,
      barangay: formData.affectedAreas.length > 0 ? formData.affectedAreas[0] : null, // Use first affected barangay as primary
      status: formData.status,
      description: formData.description || null,
      estimated_restoration_at: formData.eta || null
      // created_at and updated_at are handled by DB default
  };

  console.log('Inserting to announcements:', announcementData);

  try {
      const { data, error } = await supabase
          .from('announcements')
          .insert([announcementData])
          .select(); // Select the inserted data

      if (error) {
          throw error;
      }

      console.log('Supabase insert success:', data);
      window.showSuccessPopup(`Announcement posted as "${formData.status}"!`);

      // TODO: Update the status of the original reports in the 'reports' table
      if (reportIds && reportIds.length > 0) {
          const { error: updateError } = await supabase
            .from('reports')
            .update({ status: 'Ongoing' }) // Or 'Reported', depending on your flow
            .in('id', reportIds);
          
          if (updateError) {
              console.error('Error updating reports status:', updateError);
              window.showErrorPopup('Announcement posted, but failed to update reports.');
          }
      }

      // Refresh view if refresh function exists
      if (typeof window.refreshCurrentView === 'function') {
          window.refreshCurrentView();
      }
      
  } catch (error) {
      console.error('Error posting announcement:', error.message);
      window.showErrorPopup(`Error posting announcement: ${error.message}`);
  }
}


/**
 * Handle outages update (mock implementation)
 */
async function handleOutagesUpdate(outageIds, formData, feederId) {
  console.log(`Updating ${outageIds.length} outages/announcements:`, formData);

  if (!window.supabase) {
      console.error('Supabase client not found.');
      window.showErrorPopup('Database connection failed.');
      return;
  }

  // Map form data to the 'announcements' table schema for updating
  const announcementData = {
      feeder_id: feederId ? parseInt(feederId) : null,
      type: formData.outageType,
      cause: formData.cause || null,
      location: formData.location || null,
      pictures: formData.imageUrls.length > 0 ? formData.imageUrls : null,
      areas_affected: formData.affectedAreas.length > 0 ? formData.affectedAreas : null,
      barangay: formData.affectedAreas.length > 0 ? formData.affectedAreas[0] : null,
      status: formData.status,
      description: formData.description || null,
      estimated_restoration_at: formData.eta || null,
      updated_at: new Date().toISOString() // Manually set updated_at
  };

  console.log('Updating announcements:', announcementData);

  try {
      const { data, error } = await supabase
          .from('announcements')
          .update(announcementData)
          .in('id', outageIds); // Apply update to all selected IDs

      if (error) {
          throw error;
      }
      
      console.log('Supabase update success:', data);
      window.showSuccessPopup("Outage updated successfully!");

      // Refresh view if applyFiltersAndRender function exists (e.g., on outages.js)
      if (typeof window.applyFiltersAndRender === 'function') {
          window.applyFiltersAndRender();
      }

  } catch (error) {
      console.error('Error updating announcement:', error.message);
      window.showErrorPopup(`Error updating announcement: ${error.message}`);
  }
}

// --- MAIN SCRIPT LOGIC ---

document.addEventListener("DOMContentLoaded", () => {
  console.log("shared.js v6 (Merged): DOMContentLoaded");

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
      window.setupDropdownToggle("feederFilterBtn", "feederPopup");
      const feederToggles = feederPopup.querySelectorAll(".feeder-toggle");
      const feederClearAll = document.getElementById("feederClearAll");
      const feederSelectAll = document.getElementById("feederSelectAll");

      const setTogglesState = (select) => {
          feederToggles.forEach((btn) => {
              if (select) { 
                btn.classList.add("bg-blue-500", "text-white"); 
                btn.classList.remove("bg-gray-200", "dark:bg-gray-700"); 
              } else { 
                btn.classList.remove("bg-blue-500", "text-white"); 
                btn.classList.add("bg-gray-200", "dark:bg-gray-700"); 
              }
          });
          callPageFilter();
      };

      feederToggles.forEach((btn) => {
          btn.addEventListener("click", () => {
              btn.classList.toggle("bg-blue-500"); 
              btn.classList.toggle("text-white");
              btn.classList.toggle("bg-gray-200"); 
              btn.classList.toggle("dark:bg-gray-700");
              callPageFilter();
          });
      });

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

  // --- Profile Dropdown & Modal Logic (from sharedog.js) ---
  const openProfileModalBtn = document.getElementById('openProfileModalBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
  const cancelUpdateBtn = document.getElementById('cancelUpdateBtn');
  const profileUpdateForm = document.getElementById('profileUpdateForm');
  const adminNameSpan = document.getElementById('adminName');
  const nicknameInput = document.getElementById('nicknameInput');
  const adminProfileImg = document.getElementById('adminProfile');
  const profilePicInput = document.getElementById('profilePictureInput');
  const passwordInput = document.getElementById('passwordInput');

  // Load saved profile info on page load
  try {
      const savedNickname = localStorage.getItem('adminNickname');
      if (savedNickname) {
          if (adminNameSpan) adminNameSpan.textContent = savedNickname.toUpperCase();
          if (nicknameInput) nicknameInput.value = savedNickname;
      }

      const savedProfilePic = localStorage.getItem('adminProfilePic');
      if (savedProfilePic) {
          if (adminProfileImg) adminProfileImg.src = savedProfilePic;
      }
  } catch (e) {
      console.error("Error loading profile from localStorage:", e);
  }

  // 1. Dropdown Toggle Logic
  window.setupDropdownToggle("profileTrigger", "profileDropdown");

  // 2. Modal Open/Close Logic
  const openModal = () => {
      if (profileModal) {
          profileModal.classList.remove('hidden');
          profileModal.classList.add('flex');
          const profileDropdown = document.getElementById('profileDropdown');
          if (profileDropdown) profileDropdown.classList.add('hidden');
      }
  };
  const closeModal = () => {
      if (profileModal) {
          profileModal.classList.add('hidden');
          profileModal.classList.remove('flex');
      }
  };

  if (openProfileModalBtn) openProfileModalBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
  if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', closeModal);
  if (cancelUpdateBtn) cancelUpdateBtn.addEventListener('click', closeModal);
  if (profileModal) profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && profileModal && !profileModal.classList.contains('hidden')) closeModal(); });

  // 3. Logout Button Logic
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    console.log("DEBUG: Logout button found, adding listener.");
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("DEBUG: Logout CLICKED.");
      try {
          window.location.href = 'login.html';
          console.log("DEBUG: Redirect command executed.");
      } catch (redirectError) {
          console.error("DEBUG: Error during redirect attempt:", redirectError);
      }
    });
  } else {
      console.error("DEBUG: Logout button (#logoutBtn) NOT FOUND.");
  }

  // 4. Form Submission
  if (profileUpdateForm && adminNameSpan && nicknameInput && passwordInput) {
      profileUpdateForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const newNickname = nicknameInput.value.trim();
          const newPassword = passwordInput.value;

          let updated = false;

          if (newNickname && newNickname !== localStorage.getItem('adminNickname')) {
              adminNameSpan.textContent = newNickname.toUpperCase();
              try {
                  localStorage.setItem('adminNickname', newNickname);
                  updated = true;
              } catch (err) {
                  console.error("Error saving nickname to localStorage:", err);
              }
          }

          if (newPassword) {
              console.warn("Password update functionality not yet implemented.");
              // In a real app, you would hash and send this to a server.
              updated = true;
          }

          closeModal();
          if (updated) {
              window.showSuccessPopup("Profile settings updated!");
          }
          passwordInput.value = '';
      });
  }

  // 5. Handle Profile Picture
  if (profilePicInput && adminProfileImg) {
      profilePicInput.addEventListener('change', function() {
          const file = this.files[0];
          if (file) {
              if (file.size > 5 * 1024 * 1024) { // 5MB limit
                  console.error("Image file is too large.");
                  window.showErrorPopup("Image file is too large (Max 5MB).");
                  profilePicInput.value = '';
                  return;
              }

              const reader = new FileReader();
              reader.onload = function(e) {
                  const imageDataUrl = e.target.result;
                  adminProfileImg.src = imageDataUrl;
                  try {
                      localStorage.setItem('adminProfilePic', imageDataUrl);
                  } catch (err) {
                      console.error("Error saving profile picture to localStorage:", err);
                      window.showErrorPopup("Could not save profile picture.");
                  }
              }
              reader.readAsDataURL(file);
          }
      });
  }

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

}); // End DOMContentLoaded

