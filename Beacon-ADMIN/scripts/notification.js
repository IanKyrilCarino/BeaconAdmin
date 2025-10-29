// ==========================
// SHARED SCRIPT (v7 - Notification Badge)
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
  
  // This should be fetched from Supabase, but leaving as static for now.
  const dispatchTeams = [
    { id: 'alpha', name: 'Team Alpha' },
    { id: 'beta', name: 'Team Beta' },
    { id: 'gamma', name: 'Team Gamma' }
  ];

  // Get data based on context
  let itemsData = [];
  let allAssociatedIds = [];
  let pendingItems = [];
  let outagesData = [];
  
  if (context === 'reports') {
    pendingItems = window.getPendingItems ? window.getPendingItems() : [];
    
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
    outagesData = window.getOutages ? window.getOutages() : [];
    itemsData = outagesData.filter(o => itemIds.includes(o.id));
    allAssociatedIds = itemIds;
  }

  const initialData = itemsData[0] || {};
  
  // Generate area buttons based on context
  let areaButtonsHTML = '';
  if (context === 'reports' && options.currentFeederId) {
    const barangaysInFeeder = [...new Set(
      pendingItems
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
    const allBarangays = [...new Set(outagesData.flatMap(o => o.affected_areas || []).filter(Boolean))];
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
 * Handle reports update (Supabase logic to be added)
 */
async function handleReportsUpdate(reportIds, formData) {
  console.log(`Updating ${reportIds.length} reports:`, formData);
  
  // --- SUPABASE LOGIC WILL GO HERE ---
  // e.g., call a Postgres function to create an outage
  // and update all 'reportIds' in a transaction.
  // const { error } = await supabase.rpc('create_outage_from_reports', { 
  //   r_ids: reportIds, 
  //   form_data: formData 
  // });
  
  // if(error) { /* handle error */ }

  window.showSuccessPopup(`Announcement posted as "${formData.status}"! Reports moved to Outages page.`);
  
  // Refresh view if refresh function exists
  if (typeof window.refreshCurrentView === 'function') {
    window.refreshCurrentView();
  }
}

/**
 * Handle outages update (Supabase logic to be added)
 */
async function handleOutagesUpdate(outageIds, formData) {
  console.log(`Updating ${outageIds.length} outages:`, formData);
  
  // --- SUPABASE LOGIC WILL GO HERE ---
  // e.g., update the 'outages' table for each id.
  // const { error } = await supabase
  //   .from('outages')
  //   .update({
  //     title: `${formData.cause} - ${formData.location}`,
  //     description: formData.description,
  //     status: formData.status,
  //     type: formData.outageType,
  //     affected_areas: formData.affectedAreas,
  //     eta: formData.eta || null,
  //     latitude: formData.latitude || null,
  //     longitude: formData.longitude || null,
  //     dispatch_team: formData.dispatchTeam
  //   })
  //   .in('id', outageIds);
    
  // if(error) { /* handle error */ }
  
  window.showSuccessPopup("Outage updated successfully!");
  
  // Refresh view if applyFiltersAndRender function exists
  if (typeof window.applyFiltersAndRender === 'function') {
    window.applyFiltersAndRender();
  }
}

// --- MAIN SCRIPT LOGIC ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("shared.js v7: DOMContentLoaded");
  
  // --- Notification Badge Function (GLOBAL) ---
  window.updateNotificationBadge = async function() {
    const badge = document.getElementById('notificationBadge');
    if (!badge || !window.supabase) return;
  
    // Fetch count of unread notifications
    // RLS (Row Level Security) in Supabase should handle filtering for the logged-in user.
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_read', false);
      
    if (error) {
      console.error("Error fetching notification count:", error.message);
      badge.classList.add('hidden');
      return;
    }

    // Update badge UI
    if (count > 0) {
      badge.textContent = count > 9 ? '9+' : count;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (!window.supabase) {
    console.error("Supabase client not initialized. Make sure supabase.js is loaded.");
    if (!window.location.pathname.endsWith('login.html')) {
      alert("Application failed to load. Redirecting to login.");
      window.location.href = 'login.html';
    }
    return;
  }
  
  // --- Profile Dropdown & Modal Element Declarations ---
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
  const logoutBtn = document.getElementById('logoutBtn');

  // --- Authenticate and Load User Profile ---
  const { data: { session } } = await supabase.auth.getSession();
  let user = session?.user;

  // If no session, redirect to login, unless we are already on the login page
  if (!session && !window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
      return; // Stop executing script
  }
  
  // If we have a user, load their profile info
  if (user) {
      const userNickname = user.user_metadata?.nickname || user.email.split('@')[0];
      const userProfilePic = user.user_metadata?.profile_pic_url;

      // Populate UI
      if (adminNameSpan) adminNameSpan.textContent = userNickname.toUpperCase();
      if (nicknameInput) nicknameInput.value = userNickname;
      if (adminProfileImg && userProfilePic) adminProfileImg.src = userProfilePic;

      // Cache in localStorage as a fallback/legacy support
      try {
          if (userNickname) localStorage.setItem('adminNickname', userNickname);
          if (userProfilePic) localStorage.setItem('adminProfilePic', userProfilePic);
      } catch (e) {
          console.error("Error caching profile to localStorage:", e);
      }
  }
  
  // --- Load Notification Count ---
  await window.updateNotificationBadge();
  // --- End User Profile Load ---

  // --- Universal Filter Callback ---
  const callPageFilter = () => {
      if (typeof window.applyFilters === "function") {
          window.applyFilters();
      } else {
          console.warn("No page-specific filter function found (window.applyFilters).");
      }
  };
  
  // --- Inject Notification Badge Element ---
  try {
    const notifLink = document.querySelector('a.sidebar-link[href="notifications.html"]');
    if (notifLink) {
      notifLink.classList.add('relative'); // Ensure relative positioning for the badge
      const badge = document.createElement('span');
      badge.id = 'notificationBadge';
      // Added z-10 to ensure it's above other elements
      badge.className = 'absolute top-1 right-1 w-5 h-5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center justify-center hidden z-10';
      notifLink.appendChild(badge);
    }
  } catch (e) {
    console.error("Error injecting notification badge:", e);
  }

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
            const formatted = new Date(dateInput.value).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("Error signing out:", error.message);
          alert("Logout failed. Please try again.");
        } else {
          window.location.href = 'login.html';
        }
      } catch (err) {
        console.error("Logout error:", err);
        alert("An unexpected error occurred during logout.");
      }
    });
  } else {
      console.error("Logout button (#logoutBtn) NOT FOUND.");
  }

  // 4. Form Submission
  if (profileUpdateForm && adminNameSpan && nicknameInput && passwordInput) {
      profileUpdateForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const newNickname = nicknameInput.value.trim();
          const newPassword = passwordInput.value;
          let updated = false;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
              window.showSuccessPopup("Error: Not authenticated."); // Should be an error popup
              return;
          }

          // --- Nickname Update ---
          if (newNickname && newNickname !== (user.user_metadata?.nickname || '')) {
              const { error } = await supabase.auth.updateUser({
                  data: { nickname: newNickname }
              });
              
              if (error) {
                  console.error("Error updating nickname:", error.message);
                  window.showSuccessPopup("Error updating nickname."); // Should be an error popup
              } else {
                  adminNameSpan.textContent = newNickname.toUpperCase();
                  localStorage.setItem('adminNickname', newNickname); // Update local cache
                  updated = true;
              }
          }

          // --- Password Update ---
          if (newPassword) {
              const { error } = await supabase.auth.updateUser({
                  password: newPassword
              });
              if (error) {
                  console.error("Error updating password:", error.message);
                  window.showSuccessPopup("Error updating password."); // Should be an error popup
              } else {
                  updated = true;
              }
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
      profilePicInput.addEventListener('change', async function() {
          const file = this.files[0];
          if (!file) return;

          if (file.size > 5 * 1024 * 1024) { // 5MB limit
              alert("Image file is too large. Please select a file under 5MB.");
              profilePicInput.value = '';
              return;
          }
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
              alert("You must be logged in to upload a picture.");
              return;
          }

          // --- Supabase Storage Upload ---
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          const filePath = `avatars/${fileName}`;
          
          adminProfileImg.style.opacity = '0.5'; // Loading state

          const { error: uploadError } = await supabase.storage
              .from('profile-pics') // ASSUMES 'profile-pics' BUCKET
              .upload(filePath, file);

          if (uploadError) {
              console.error("Error uploading profile picture:", uploadError.message);
              alert("Failed to upload profile picture. Please check the console.");
              adminProfileImg.style.opacity = '1';
              profilePicInput.value = '';
              return;
          }

          // --- Get Public URL ---
          const { data: urlData } = supabase.storage
              .from('profile-pics')
              .getPublicUrl(filePath);

          if (!urlData || !urlData.publicUrl) {
              console.error("Could not get public URL for uploaded image.");
              alert("Upload succeeded but failed to get image URL.");
              adminProfileImg.style.opacity = '1';
              return;
          }
          
          const publicUrl = urlData.publicUrl;

          // --- Update User Metadata ---
          const { error: metaError } = await supabase.auth.updateUser({
              data: { profile_pic_url: publicUrl }
          });

          if (metaError) {
              console.error("Error updating user metadata:", metaError.message);
              alert("Picture uploaded, but failed to save to profile. Check console.");
          } else {
              adminProfileImg.src = publicUrl;
              localStorage.setItem('adminProfilePic', publicUrl); // Cache the URL
              window.showSuccessPopup("Profile picture updated!");
          }
          
          adminProfileImg.style.opacity = '1';
      });
  }

}); // End DOMContentLoaded