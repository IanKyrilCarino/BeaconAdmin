// ==========================
// SHARED SCRIPT (v5 - Unified Modal System)
// (Contains universal utilities, UI logic, and unified modals)
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
// UNIFIED MODAL SYSTEM FOR REPORTS & OUTAGES
// ==========================

/**
 * Unified function to show update modal for both Reports and Outages
 * @param {Array} itemIds - Array of item IDs to update
 * @param {string} context - 'reports' or 'outages'
 * @param {Object} options - Additional options like currentFeederId, currentBarangay
 */
window.showUpdateModal = function(itemIds, context, options = {}) {
  if (!Array.isArray(itemIds) || itemIds.length === 0) return;
  
  const isBulk = itemIds.length > 1;
  const dispatchTeams = [
    { id: 'alpha', name: 'Team Alpha' },
    { id: 'beta', name: 'Team Beta' },
    { id: 'gamma', name: 'Team Gamma' }
  ];

  // Get data based on context
  let itemsData = [];
  let allAssociatedIds = [];
  
  if (context === 'reports') {
    // For reports, we need to get pending items
    const pendingItems = window.getPendingItems ? window.getPendingItems() : [];
    
    if (options.currentView === 'barangays') {
      itemsData = itemIds.map(barangayName => ({ barangay: barangayName }));
      allAssociatedIds = pendingItems
        .filter(r => r.feeder === options.currentFeederId && itemIds.includes(r.barangay))
        .map(r => r.id);
    } else {
      itemsData = pendingItems.filter(r => itemIds.includes(r.id));
      allAssociatedIds = itemIds;
    }
  } else if (context === 'outages') {
    // For outages, get from mockOutages or global data
    const outagesData = window.mockOutages || [];
    itemsData = outagesData.filter(o => itemIds.includes(o.id));
    allAssociatedIds = itemIds;
  }

  const initialData = itemsData[0] || {};
  
  // Generate area buttons based on context
  let areaButtonsHTML = '';
  if (context === 'reports' && options.currentFeederId) {
    const barangaysInFeeder = [...new Set((window.mockAllReports || [])
      .filter(r => r.feeder === options.currentFeederId)
      .map(r => r.barangay)
    )];
    const preSelectedBarangays = [...new Set(itemsData.map(item => item.barangay))];
    
    areaButtonsHTML = barangaysInFeeder.map(b => {
      const isSelected = preSelectedBarangays.includes(b);
      return `<button type="button" class="area-toggle-btn px-3 py-1.5 rounded-full text-sm font-medium transition ${
        isSelected
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }" data-barangay="${b}">${b}</button>`;
    }).join('');
  } else if (context === 'outages') {
    const allBarangays = [...new Set((window.mockOutages || []).flatMap(o => o.affected_areas || []).filter(Boolean))];
    const preSelectedBarangays = initialData.affected_areas || [];
    
    areaButtonsHTML = allBarangays.map(b => {
      const isSelected = preSelectedBarangays.includes(b);
      return `<button type="button" class="area-toggle-btn px-3 py-1.5 rounded-full text-sm font-medium transition ${
        isSelected
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
      }" data-barangay="${b}">${b}</button>`;
    }).join('');
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
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Areas Affected</label>
          <div id="areasButtonContainer" class="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 min-h-[40px]">
            ${areaButtonsHTML}
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Coordinates</label>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" class="sr-only peer" id="coordinatesToggle" 
                   ${(initialData.latitude && initialData.longitude) ? 'checked' : ''}>
            <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            <span class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Use Coordinates</span>
          </label>
          <div id="coordinatesInputContainer" class="mt-2 ${(initialData.latitude && initialData.longitude) ? '' : 'hidden'}">
            <input type="text" id="coordinatesInput" placeholder="Latitude, Longitude" 
                   class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700" 
                   value="${(initialData.latitude && initialData.longitude) ? `${initialData.latitude}, ${initialData.longitude}` : ''}">
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

  // Area toggle buttons
  modal.querySelectorAll('.area-toggle-btn').forEach(btn => {
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
    });
  });

  // Status change handler
  const statusSelect = modal.querySelector('#statusSelect');
  const dispatchSection = modal.querySelector('#dispatchTeamSection');
  statusSelect.addEventListener('change', () => 
    dispatchSection.classList.toggle('hidden', statusSelect.value !== 'Ongoing')
  );

  // Coordinates toggle
  const coordinatesToggle = modal.querySelector('#coordinatesToggle');
  const coordinatesInputContainer = modal.querySelector('#coordinatesInputContainer');
  coordinatesToggle.addEventListener('change', () => 
    coordinatesInputContainer.classList.toggle('hidden', !coordinatesToggle.checked)
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
  modal.querySelector('#updateForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const formData = {
      outageType: modal.querySelector('input[name="outageType"]:checked').value,
      cause: modal.querySelector('#causeInput').value,
      location: modal.querySelector('#locationInput').value,
      status: modal.querySelector('#statusSelect').value,
      description: modal.querySelector('#modalDescription').value,
      eta: modal.querySelector('#modalEta').value,
      dispatchTeam: modal.querySelector('#dispatchTeamSelect')?.value || null,
      affectedAreas: Array.from(modal.querySelectorAll('.area-toggle-btn.bg-blue-600'))
        .map(btn => btn.dataset.barangay)
    };

    // Handle coordinates
    if (coordinatesToggle.checked) {
      const coords = modal.querySelector('#coordinatesInput').value.split(',');
      if (coords.length === 2) {
        formData.latitude = parseFloat(coords[0].trim());
        formData.longitude = parseFloat(coords[1].trim());
      }
    }

    // Call context-specific update handler
    if (context === 'reports') {
      handleReportsUpdate(allAssociatedIds, formData);
    } else if (context === 'outages') {
      handleOutagesUpdate(allAssociatedIds, formData);
    }

    modal.remove();
  });
};

/**
 * Handle reports update (mock implementation)
 */
function handleReportsUpdate(reportIds, formData) {
  console.log(`Updating ${reportIds.length} reports:`, formData);
  
  // Update mock data
  reportIds.forEach(id => {
    const reportIndex = window.mockAllReports.findIndex(r => r.id === id);
    if (reportIndex !== -1) {
      window.mockAllReports[reportIndex].status = formData.status;
      // Update other fields as needed
    }
  });

  window.showSuccessPopup(`Announcement posted as "${formData.status}"! Reports moved to Outages page.`);
  
  // Refresh view if refresh function exists
  if (typeof window.refreshCurrentView === 'function') {
    window.refreshCurrentView();
  }
}

/**
 * Handle outages update (mock implementation)
 */
function handleOutagesUpdate(outageIds, formData) {
  console.log(`Updating ${outageIds.length} outages:`, formData);
  
  // Generate title from cause and location
  const title = `${formData.cause} - ${formData.location}`;
  
  // Update mock data
  outageIds.forEach(id => {
    const outageIndex = window.mockOutages.findIndex(o => o.id === id);
    if (outageIndex !== -1) {
      Object.assign(window.mockOutages[outageIndex], {
        title: title,
        description: formData.description,
        status: formData.status,
        type: formData.outageType,
        affected_areas: formData.affectedAreas,
        eta: formData.eta || null,
        latitude: formData.latitude || null,
        longitude: formData.longitude || null,
        dispatch_team: formData.dispatchTeam
      });
    }
  });

  window.showSuccessPopup("Outage updated successfully!");
  
  // Refresh view if applyFiltersAndRender function exists
  if (typeof window.applyFiltersAndRender === 'function') {
    window.applyFiltersAndRender();
  }
}

// --- MAIN SCRIPT LOGIC ---

document.addEventListener("DOMContentLoaded", () => {
  console.log("shared.js v5: DOMContentLoaded");

  // --- Universal Filter Callback ---
  const callPageFilter = () => {
      if (typeof window.applyFilters === "function") {
          window.applyFilters();
      } else {
          console.warn("No page-specific filter function found (window.applyFilters).");
      }
  };

  // --- Sidebar Highlighting ---
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

  // --- Date Dropdown Logic ---
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

  // --- Feeder Filter UI Logic (SHARED) ---
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

  // --- Search Input Logic (SHARED) ---
  const searchInput = document.getElementById("locationSearch");
  if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener("input", () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(callPageFilter, 300);
      });
  }

  // --- Profile Dropdown & Modal Logic ---
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
// --- Logout Button Logic (SIMPLIFIED TEST) ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    console.log("DEBUG: Logout button found, adding SIMPLIFIED listener.");
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log("DEBUG: SIMPLIFIED Logout CLICKED.");
      alert("Attempting redirect now..."); // Use a simple alert
      try {
          window.location.href = 'login.html';
          console.log("DEBUG: Redirect command executed."); // Log if the line is reached
      } catch (redirectError) {
          console.error("DEBUG: Error during redirect attempt:", redirectError); // Log any error during redirect itself
          alert("Redirect failed. Check console.");
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
              if (file.size > 5 * 1024 * 1024) {
                  alert("Image file is too large. Please select a file under 5MB.");
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
                      alert("Could not save profile picture. Browser storage may be full.");
                  }
              }
              reader.readAsDataURL(file);
          }
      });
  }

}); // End DOMContentLoaded