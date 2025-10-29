// ==========================
// REPORTS PAGE SCRIPT - Ready connect sa backend
// ==========================

document.addEventListener("DOMContentLoaded", () => {
  console.log("Reports Page Script (V9) Loaded.");

  // --- App State ---
  let allReports = []; // Will hold all reports from Supabase

  // Config data
  const STATUS_COLORS = {
    PENDING: { primary: "bg-yellow-500", value: "text-yellow-600", tag: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100" },
    Reported: { primary: "bg-red-500", value: "text-red-600", tag: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" },
    Ongoing: { primary: "bg-blue-500", value: "text-blue-600", tag: "bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100" },
    Completed: { primary: "bg-green-500", value: "text-green-600", tag: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" }
  };

  // --- Element References ---
  const feederTilesContainer = document.getElementById("feederTiles");
  const reportsContainer = document.getElementById("reportsContainer");
  const reportsBody = document.getElementById("reportsBody");
  const reportsThead = document.getElementById("reportsThead");
  const reportsTitle = document.getElementById("reportsTitle");
  const backBtn = document.getElementById("backBtn");
  const bulkUpdateBtn = document.getElementById("bulkUpdateBtn");

  const statusFilterEl = document.getElementById('statusFilter');
  const sortFilterEl = document.getElementById('sortFilter');
  const searchInputEl = document.getElementById('searchInput');
  const sortWithPicturesEl = document.getElementById('sortWithPictures');
  const sortWithCoordsEl = document.getElementById('sortWithCoords');

  const showingCountEl = document.getElementById('showingCount');
  const totalCountEl = document.getElementById('totalCount');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  const emptyState = document.getElementById('emptyState');

  // --- App State ---
  let currentView = 'feeders';
  let currentFeederId = null;
  let currentBarangay = null;
  let allFeederData = {};
  let currentDisplayData = [];
  let selectedItems = new Set();
  let currentPage = 1;
  const itemsPerPage = 12;

  // ===================================
  // COORDINATES COPY FUNCTION
  // ===================================
  function handleCopyCoords(e) {
    const btn = e.target.closest('.copy-coords-btn');
    if (!btn) return;

    const coords = btn.dataset.coords;
    if (!coords || coords === 'Undetermined' || coords === 'N/A') return;

    navigator.clipboard.writeText(coords).then(() => {
      window.showSuccessPopup("Coordinates Copied!"); 
      const originalHTML = btn.innerHTML;
      btn.innerHTML = '<span class="material-icons text-sm text-green-600">check</span>';
      setTimeout(() => {
        if (btn && btn.parentNode) {
            btn.innerHTML = originalHTML;
        }
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy coordinates:', err);
    });
  }

  // ===================================
  // INITIALIZATION
  // ===================================
  async function init() {
    createFeederTiles();
    
    // Fetch all report data from Supabase first
    await fetchAllReports();
    
    // Now that data is loaded, proceed with aggregation and UI setup
    loadAndAggregateFeederData();
    attachEventListeners();
    showFeederTilesView();
    console.log("Reports system initialized");
  }

  // ===================================
  // DATA LOADING & AGGREGATION
  // ===================================

  /**
   * Fetches all reports from Supabase and stores them in the `allReports` variable.
   */
  async function fetchAllReports() {
    console.log("Fetching all reports from Supabase...");
    if (!window.supabase) {
      console.error("Supabase client not found.");
      feederTilesContainer.innerHTML = `<p class="text-red-500 col-span-full">Error: Supabase connection failed.</p>`;
      return;
    }

    try {
      // Assumes your table is named 'reports'
      const { data, error } = await supabase
        .from('reports')
        .select('*');
        
      if (error) {
        throw error;
      }
      
      allReports = data || [];
      console.log(`Fetched ${allReports.length} total reports.`);

    } catch (error) {
      console.error("Error fetching reports:", error.message);
      feederTilesContainer.innerHTML = `<p class="text-red-500 col-span-full">Error loading reports: ${error.message}</p>`;
    }
  }

  /**
   * Helper function to get ONLY the "PENDING" items from the live data.
   * Made globally available for unified modal system
   */
  function getPendingItems() {
    return allReports.filter(r => r.status === 'PENDING');
  }

  // Make getPendingItems globally available for the unified modal system
  window.getPendingItems = getPendingItems;

  function loadAndAggregateFeederData() {
    const feederAggregates = {};
    for (let i = 1; i <= 14; i++) {
      feederAggregates[i] = { reports: [], status: "Completed", reportCount: 0 };
    }

    // *** Only aggregate "PENDING" items ***
    getPendingItems().forEach(report => {
      if (feederAggregates[report.feeder]) {
        feederAggregates[report.feeder].reports.push(report);
        feederAggregates[report.feeder].reportCount++;
      }
    });

    // Determine aggregate status (PENDING or Completed)
    for (const feederId in feederAggregates) {
      feederAggregates[feederId].status = (feederAggregates[feederId].reportCount > 0) ? "PENDING" : "Completed";
    }

    allFeederData = feederAggregates;
    updateFeederTilesUI();
  }

  function aggregateBarangayData(feederId) {
    const barangayGroups = {};

    // *** Only filter "PENDING" items for this feeder ***
    getPendingItems()
      .filter(report => report.feeder === feederId)
      .forEach(report => {
        if (!barangayGroups[report.barangay]) {
          barangayGroups[report.barangay] = {
            barangay: report.barangay,
            reports: [],
            totalVolume: 0,
            causes: {},
            status: "PENDING",
            coordinates: null
          };
        }
        const group = barangayGroups[report.barangay];
        group.reports.push(report);
        group.totalVolume += report.volume || 0;
        const cause = report.cause || "Undetermined";
        group.causes[cause] = (group.causes[cause] || 0) + 1;

        if (report.latitude && report.longitude && !group.coordinates) {
          group.coordinates = `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`;
        }
      });

    return Object.values(barangayGroups).map(group => {
      let commonCause = "N/A";
      let maxCount = 0;
      Object.entries(group.causes).forEach(([cause, count]) => {
        if (count > maxCount) {
          commonCause = cause;
          maxCount = count;
        }
      });
      return {
        id: group.barangay,
        barangay: group.barangay,
        volume: group.totalVolume,
        commonCause: commonCause,
        status: "PENDING",
        reportCount: group.reports.length,
        coordinates: group.coordinates
      };
    });
  }

  function getIndividualReports(barangayName) {
    // *** Only return "PENDING" items for this barangay ***
    return getPendingItems().filter(report => report.barangay === barangayName);
  }

  // ===================================
  // VIEW MANAGEMENT
  // ===================================

  function showFeederTilesView() {
    currentView = 'feeders';
    currentFeederId = null;
    currentBarangay = null;
    feederTilesContainer.classList.remove("hidden");
    reportsContainer.classList.add("hidden");
    reportsTitle.textContent = "Pending Reports";
    sortFilterEl.value = 'id';
    searchInputEl.value = '';

    if (statusFilterEl) statusFilterEl.closest('.relative').classList.add('hidden'); 

    sortWithPicturesEl.classList.add('hidden');
    sortWithCoordsEl.classList.add('hidden');
    resetSelections();
  }

  function showBarangayView(feederId) {
    currentView = 'barangays';
    currentFeederId = feederId;
    currentBarangay = null;
    currentPage = 1;

    currentDisplayData = aggregateBarangayData(feederId);

    feederTilesContainer.classList.add("hidden");
    reportsContainer.classList.remove("hidden");
    reportsTitle.textContent = `Pending Reports - Feeder ${feederId}`;

    if (statusFilterEl) statusFilterEl.closest('.relative').classList.add('hidden');

    sortWithPicturesEl.classList.add('hidden');
    sortWithCoordsEl.classList.add('hidden');

    updateTableHeaders();
    applyFiltersAndRender();
    resetSelections();
  }

  function showIndividualView(barangayName) {
    currentView = 'individuals';
    currentBarangay = barangayName;
    currentPage = 1;

    currentDisplayData = getIndividualReports(barangayName);

    reportsTitle.textContent = `Pending Reports - ${barangayName}`;

    if (statusFilterEl) statusFilterEl.closest('.relative').classList.add('hidden');

    sortWithPicturesEl.classList.remove('hidden');
    sortWithCoordsEl.classList.remove('hidden');

    updateTableHeaders();
    applyFiltersAndRender();
    resetSelections();
  }

  async function refreshCurrentView() {
    // Re-fetch all data from Supabase
    await fetchAllReports();

    // Re-aggregate and update UI based on new data
    loadAndAggregateFeederData();

    if (currentView === 'feeders') {
      showFeederTilesView();
    } else if (currentView === 'barangays') {
      currentDisplayData = aggregateBarangayData(currentFeederId);
      applyFiltersAndRender();
    } else if (currentView === 'individuals') {
      currentDisplayData = getIndividualReports(currentBarangay);
      applyFiltersAndRender();
    }
    
    resetSelections();
  }

  // Make refreshCurrentView globally available for the unified modal system
  window.refreshCurrentView = refreshCurrentView;

  // ===================================
  // UI & TABLE RENDERING
  // ===================================

  function createFeederTiles() {
    let tilesHTML = "";
    for (let i = 1; i <= 14; i++) {
      tilesHTML += `
        <div class="relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md hover:-translate-y-2 hover:scale-[1.03] hover:shadow-xl dark:hover:shadow-gray-900/50 cursor-pointer transition feeder-tile" data-feeder-id="${i}">
          <div id="feeder-color-${i}" class="absolute top-0 left-0 w-full h-2 bg-green-500 rounded-t-xl"></div>
          <div class="flex justify-between items-center mt-2">
            <h3 class="text-gray-700 dark:text-gray-200 font-semibold text-lg">Feeder ${i}</h3>
          </div>
          <p id="value-feeder-${i}" class="text-3xl font-bold text-green-600 mt-4">0</p>
          <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">Pending Reports</p>
        </div>
      `;
    }
    feederTilesContainer.innerHTML = tilesHTML;
  }

  function updateFeederTilesUI() {
    for (let feederId = 1; feederId <= 14; feederId++) {
      const data = allFeederData[feederId];
      if (!data) continue;
      
      const statusColor = (data.reportCount > 0) ? STATUS_COLORS.PENDING : STATUS_COLORS.Completed;

      const colorBar = document.getElementById(`feeder-color-${feederId}`);
      const valueText = document.getElementById(`value-feeder-${feederId}`);

      if (colorBar && valueText) {
        valueText.textContent = data.reportCount;
        colorBar.className = `absolute top-0 left-0 w-full h-2 ${statusColor.primary} rounded-t-xl`;
        valueText.className = `text-3xl font-bold ${statusColor.value} mt-4`;
      }
    }
  }

  function updateTableHeaders() {
    let headerHTML = '';
    const thClass = "py-3 px-4 text-left text-sm font-medium text-gray-700 dark:text-gray-300";

    if (currentView === 'barangays') {
      headerHTML = `
        <th class="${thClass} w-10">
          <input type="checkbox" id="selectAllCheckbox" class="h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300">
        </th>
        <th class="${thClass}">Barangay</th>
        <th class="${thClass}">Reports</th>
        <th class="${thClass}">Most Common Cause</th>
        <th class="${thClass}">Status</th>
        <th class="${thClass}">Coordinates</th>
        <th class="${thClass}">Actions</th>
      `;
    } else if (currentView === 'individuals') {
      headerHTML = `
        <th class="${thClass} w-10">
          <input type="checkbox" id="selectAllCheckbox" class="h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300">
        </th>
        <th class="${thClass}">Report ID</th>
        <th class="${thClass}">Timestamp</th>
        <th class="${thClass}">Description</th>
        <th class="${thClass}">Status</th>
        <th class="${thClass}">Image</th>
        <th class="${thClass}">Coordinates</th>
        <th class="${thClass}">Actions</th>
      `;
    }
    reportsThead.innerHTML = headerHTML;

    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', handleSelectAllChange);
    }
  }

  function renderTable(data) {
    if (data.length === 0) {
      reportsBody.innerHTML = '';
      emptyState.classList.remove('hidden');
      return;
    }
    emptyState.classList.add('hidden');

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    let tableHTML = '';
    if (currentView === 'barangays') {
      tableHTML = paginatedData.map(renderBarangayRow).join('');
    } else if (currentView === 'individuals') {
      tableHTML = paginatedData.map(renderIndividualRow).join('');
    }

    reportsBody.innerHTML = tableHTML;
    updateSelectedUI();
  }

  function renderBarangayRow(group) {
    const statusColor = STATUS_COLORS[group.status] || STATUS_COLORS.PENDING;
    const isSelected = selectedItems.has(group.id);
    const coordsText = group.coordinates || 'Undetermined';

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td class="py-3 px-4">
          <input type="checkbox" class="report-checkbox h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300"
                 data-id="${group.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="py-3 px-4 font-medium">${group.barangay}</td>
        <td class="py-3 px-4">${group.reportCount}</td>
        <td class="py-3 px-4 truncate max-w-xs" title="${group.commonCause}">${group.commonCause}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.tag}">
            ${group.status}
          </span>
        </td>
        <td class="py-3 px-4">
          ${group.coordinates ?
            `<div class="flex items-center space-x-1">
              <span title="${coordsText}">${coordsText}</span>
              <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}">
                <span class="material-icons text-sm">content_copy</span>
              </button>
            </div>` :
            'Undetermined'
          }
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition mr-2 view-barangay-btn" data-id="${group.id}">View</button>
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700 transition update-item-btn" data-id="${group.id}">Update</button>
        </td>
      </tr>
    `;
  }

  function renderIndividualRow(report) {
    const statusColor = STATUS_COLORS[report.status] || STATUS_COLORS.PENDING;
    const isSelected = selectedItems.has(report.id);
    const reportDate = new Date(report.created_at).toLocaleString();
    const hasImages = report.images && report.images.length > 0;
    const hasCoords = report.latitude && report.longitude;
    const coordsText = hasCoords ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}` : 'N/A';

    return `
      <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
        <td class="py-3 px-4">
          <input type="checkbox" class="report-checkbox h-4 w-4 text-blue-600 rounded-full focus:ring-blue-500 border-gray-300"
                 data-id="${report.id}" ${isSelected ? 'checked' : ''}>
        </td>
        <td class="py-3 px-4 font-medium">${report.id}</td>
        <td class="py-3 px-4">${reportDate}</td>
        <td class="py-3 px-4 truncate max-w-xs" title="${report.description}">${report.description}</td>
        <td class="py-3 px-4">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor.tag}">
            ${report.status}
          </span>
        </td>
        <td class="py-3 px-4">
          ${hasImages ?
            `<button type="button" class="text-blue-600 dark:text-blue-400 hover:underline view-images-btn" data-images='${JSON.stringify(report.images)}'>View (${report.images.length})</button>` :
            'N/A'
          }
        </td>
        <td class="py-3 px-4">
          ${hasCoords ?
            `<div class="flex items-center space-x-1">
              <span title="${coordsText}">${coordsText}</span>
              <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}">
                <span class="material-icons text-sm">content_copy</span>
              </button>
            </div>` :
            'N/A'
          }
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition mr-2 view-details-btn" data-id="${report.id}">Details</button>
          <button type="button" class="px-4 py-1.5 text-sm font-medium text-white bg-red-600 rounded-full hover:bg-red-700 transition update-item-btn" data-id="${report.id}">Update</button>
        </td>
      </tr>
    `;
  }

  // ===================================
  // FILTERING & PAGINATION
  // ===================================

  function applyFiltersAndRender() {
    const sort = sortFilterEl.value;
    const search = searchInputEl.value.toLowerCase();

    // currentDisplayData is already pre-filtered to PENDING
    let filteredData = [...currentDisplayData];

    // 1. Filter by Search
    if (search) {
      filteredData = filteredData.filter(item => {
        if (currentView === 'barangays') {
          return item.barangay.toLowerCase().includes(search) || item.commonCause.toLowerCase().includes(search) || (item.coordinates && item.coordinates.toLowerCase().includes(search));
        }
        if (currentView === 'individuals') {
          return item.description.toLowerCase().includes(search) || String(item.id).includes(search) || (item.latitude && item.longitude && `${item.latitude},${item.longitude}`.includes(search));
        }
        return false;
      });
    }

    // 2. Sort
    switch (sort) {
      case 'id':
        filteredData.sort((a, b) => (a.id > b.id ? 1 : -1));
        break;
      case 'volume-high':
        filteredData.sort((a, b) => (currentView === 'barangays' ? b.reportCount - a.reportCount : b.id - a.id));
        break;
      case 'volume-low':
        filteredData.sort((a, b) => (currentView === 'barangays' ? a.reportCount - b.reportCount : a.id - b.id));
        break;
      case 'with-pictures':
        if (currentView === 'individuals') {
          filteredData.sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0));
        }
        break;
      case 'with-coordinates':
        if (currentView === 'individuals') {
          filteredData.sort((a, b) => (a.latitude && b.latitude ? 0 : a.latitude ? -1 : 1));
        } else if (currentView === 'barangays') {
          filteredData.sort((a, b) => (a.coordinates && b.coordinates ? 0 : a.coordinates ? -1 : 1));
        }
        break;
    }

    // 3. Render
    currentPage = 1; // Reset to first page after every filter
    renderTable(filteredData);
    updatePaginationUI(filteredData);
  }

  function updatePaginationUI(data) {
    const totalItems = data.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalItems);
    showingCountEl.textContent = totalItems > 0 ? `${startIndex}-${endIndex}` : '0';
    totalCountEl.textContent = totalItems;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
  }

  function changePage(direction) {
    const totalItems = getFilteredData().length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (direction === 'next' && currentPage < totalPages) {
      currentPage++;
    } else if (direction === 'prev' && currentPage > 1) {
      currentPage--;
    }
    applyFiltersAndRender();
    resetSelections();
  }

  function getFilteredData() {
     const search = searchInputEl.value.toLowerCase();
     let filteredData = [...currentDisplayData]; // Already PENDING items
     if (search) {
       filteredData = filteredData.filter(item => {
         if (currentView === 'barangays') return item.barangay.toLowerCase().includes(search) || item.commonCause.toLowerCase().includes(search) || (item.coordinates && item.coordinates.toLowerCase().includes(search));
         if (currentView === 'individuals') return item.description.toLowerCase().includes(search) || String(item.id).includes(search) || (item.latitude && item.longitude && `${item.latitude},${item.longitude}`.includes(search));
         return false;
       });
     }
     return filteredData;
  }

  // ===================================
  // SELECTION HANDLING
  // ===================================
  function resetSelections() {
    selectedItems.clear();
    updateSelectedUI();
  }

  function handleSelectAllChange(e) {
    const isChecked = e.target.checked;
    const checkboxes = reportsBody.querySelectorAll('.report-checkbox');

    checkboxes.forEach(cb => {
      const id = (currentView === 'barangays') ? cb.dataset.id : parseInt(cb.dataset.id);
      if (isChecked) {
        selectedItems.add(id);
      } else {
        selectedItems.delete(id);
      }
    });
    updateSelectedUI();
  }

  function handleCheckboxChange(e) {
    const checkbox = e.target;
    const id = (currentView === 'barangays') ? checkbox.dataset.id : parseInt(checkbox.dataset.id);

    if (checkbox.checked) {
      selectedItems.add(id);
    } else {
      selectedItems.delete(id);
    }
    updateSelectedUI();
  }

  function updateSelectedUI() {
    reportsBody.querySelectorAll('.report-checkbox').forEach(cb => {
      const id = (currentView === 'barangays') ? cb.dataset.id : parseInt(cb.dataset.id);
      cb.checked = selectedItems.has(id);
    });

    const selectAllCheckbox = document.getElementById("selectAllCheckbox");
    if (selectAllCheckbox) {
      const allCheckboxes = reportsBody.querySelectorAll('.report-checkbox');
      const allVisibleChecked = allCheckboxes.length > 0 && Array.from(allCheckboxes).every(cb => cb.checked);

      selectAllCheckbox.checked = allVisibleChecked;
      selectAllCheckbox.indeterminate = selectedItems.size > 0 && !allVisibleChecked;
    }

    bulkUpdateBtn.classList.toggle('hidden', selectedItems.size === 0);
    bulkUpdateBtn.textContent = `Update Selected (${selectedItems.size})`;
  }

  // ===================================
  // MODAL INTEGRATION WITH UNIFIED SYSTEM
  // ===================================

  function hasCoords(report) { return report && report.latitude && report.longitude; }

  function showIndividualDetails(reportId) {
    const report = allReports.find(r => r.id === reportId); // Find from live data
    if (!report) return;
    const coordsText = hasCoords(report) ? `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}` : '';
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Report Details #${report.id}</h3>
          <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal"><span class="material-icons">close</span></button>
        </div>
        <div class="p-6 space-y-4 overflow-y-auto">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Barangay</label><p class="text-lg text-gray-900 dark:text-white">${report.barangay}</p></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${STATUS_COLORS[report.status].tag}">${report.status}</span></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Volume</label><p class="text-lg text-gray-900 dark:text-white">${report.volume || 'N/A'}</p></div>
            <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Cause</label><p class="text-lg text-gray-900 dark:text-white">${report.cause || 'Undetermined'}</p></div>
          </div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><p class="text-gray-900 dark:text-white mt-1">${report.description || 'No description provided'}</p></div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Images</label>${(report.images && report.images.length > 0) ? `<div class="grid grid-cols-3 gap-2 mt-2">${report.images.map(img => `<img src="${img}" alt="Report image" class="w-full h-24 object-cover rounded cursor-pointer hover:opacity-75 view-popup-image">`).join('')}</div>` : '<p class="text-gray-500 dark:text-gray-400 mt-1">No images submitted</p>'}</div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Coordinates</label>${hasCoords(report) ? `<div class="flex items-center space-x-2 mt-1"><span class="text-gray-900 dark:text-white">${coordsText}</span><button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}"><span class="material-icons text-sm">content_copy</span></button></div>` : '<p class="text-gray-500 dark:text-gray-400 mt-1">No coordinates submitted</p>'}</div>
          <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Reported At</label><p class="text-gray-900 dark:text-white">${new Date(report.created_at).toLocaleString()}</p></div>
        </div>
        <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition close-modal">Close</button>
          <button type="button" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition update-from-details" data-id="${report.id}">Update</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.querySelector('.update-from-details').addEventListener('click', function() {
      const reportId = parseInt(this.dataset.id); 
      selectedItems.clear(); 
      selectedItems.add(reportId); 
      modal.remove(); 
      // Use unified modal system
      window.showUpdateModal([reportId], 'reports', {
        currentView: currentView,
        currentFeederId: currentFeederId,
        currentBarangay: currentBarangay
      });
    });
    modal.querySelectorAll('.copy-coords-btn').forEach(btn => btn.addEventListener('click', handleCopyCoords));
    modal.querySelectorAll('.view-popup-image').forEach(img => img.addEventListener('click', () => showImageModal(img.src)));
  }

  function showImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4';
    modal.addEventListener('click', () => modal.remove());
    modal.innerHTML = `<div class="relative max-w-3xl max-h-[90vh]"><button type="button" class="absolute -top-10 right-0 text-white text-3xl font-bold">&times;</button><img src="${imageUrl}" class="w-full h-auto object-contain max-h-[90vh] rounded-lg"></div>`;
    document.body.appendChild(modal);
  }

  // ===================================
  // EVENT LISTENERS
  // ===================================
  function attachEventListeners() {
    feederTilesContainer.addEventListener("click", (e) => {
      const tile = e.target.closest(".feeder-tile");
      if (!tile) return;
      const feederId = parseInt(tile.dataset.feederId);
      if (feederId) showBarangayView(feederId);
    });

    backBtn.addEventListener("click", () => {
      if (currentView === 'individuals') showBarangayView(currentFeederId);
      else if (currentView === 'barangays') showFeederTilesView();
    });

    // Updated bulk update to use unified modal system
    bulkUpdateBtn.addEventListener('click', () => {
      if (selectedItems.size === 0) return;
      window.showUpdateModal(Array.from(selectedItems), 'reports', {
        currentView: currentView,
        currentFeederId: currentFeederId,
        currentBarangay: currentBarangay
      });
    });

    // Event delegation for table buttons
    reportsBody.addEventListener('click', (e) => {
      const target = e.target;
      const id = target.dataset.id; // Could be barangay name or report ID
      const btn = target.closest('button'); 

      if (!btn) return;

      if (btn.classList.contains('copy-coords-btn')) {
          handleCopyCoords(e);
          return;
      }

      if (currentView === 'barangays') {
        if (btn.classList.contains('view-barangay-btn')) {
          showIndividualView(id);
        } else if (btn.classList.contains('update-item-btn')) {
          selectedItems.clear(); 
          selectedItems.add(id); 
          window.showUpdateModal([id], 'reports', {
            currentView: currentView,
            currentFeederId: currentFeederId,
            currentBarangay: currentBarangay
          });
        }
      } else if (currentView === 'individuals') {
        if (btn.classList.contains('update-item-btn')) {
          selectedItems.clear(); 
          selectedItems.add(parseInt(id)); 
          window.showUpdateModal([parseInt(id)], 'reports', {
            currentView: currentView,
            currentFeederId: currentFeederId,
            currentBarangay: currentBarangay
          });
        } else if (btn.classList.contains('view-details-btn')) {
          showIndividualDetails(parseInt(id));
        } else if (btn.classList.contains('view-images-btn')) {
          const images = JSON.parse(btn.dataset.images);
          if (images.length > 0) showImageModal(images[0]);
        }
      }
    });

    reportsBody.addEventListener('change', (e) => {
      if (e.target.classList.contains('report-checkbox')) handleCheckboxChange(e);
    });

    sortFilterEl.addEventListener('change', applyFiltersAndRender);
    searchInputEl.addEventListener('input', applyFiltersAndRender);

    prevPageBtn.addEventListener('click', () => changePage('prev'));
    nextPageBtn.addEventListener('click', () => changePage('next'));
  }

  // --- Start ---
  init();
});