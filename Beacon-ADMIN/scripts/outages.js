// ==========================
// OUTAGES PAGE SCRIPT -
// ==========================
// Loaded LAST only on outages.html

document.addEventListener("DOMContentLoaded", () => {

    // --- Essential Elements ---
    const outagesContainer = document.getElementById("outagesContainer");
    const emptyState = document.getElementById("emptyState");

    if (!outagesContainer) {
        console.error("CRITICAL ERROR v4.0: Outages container (#outagesContainer) not found!");
        return;
    }
    if (!emptyState) {
        console.warn("WARN v4.0: Empty state element (#emptyState) not found.");
    }

    // --- State Variables ---
    let allOutages = [];
    let currentDisplayData = [];

    // --- CONFIG ---
    const STATUS_COLORS = {
        Reported: { border: "border-red-500", tag: "bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100" },
        Ongoing: { border: "border-yellow-500", tag: "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100" },
        Completed: { border: "border-green-500", tag: "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100" },
        Default: { border: "border-gray-500", tag: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"}
    };
    // Expose globally for other scripts (e.g., dashboard)
    window.STATUS_COLORS = STATUS_COLORS;


    // ===================================
    // DATA FETCHING (SUPABASE)
    // ===================================

    /**
     * Fetches all feeder data from Supabase to populate the filter.
     */
    async function populateFeederFilters() {
        const container = document.getElementById("feederButtonContainer");
        if (!container) return;

        container.innerHTML = `<span classclass="col-span-3 text-xs text-gray-500">Loading feeders...</span>`;

        if (!window.supabase) {
            container.innerHTML = `<span class="col-span-3 text-xs text-red-500">Supabase error.</span>`;
            return;
        }

        try {
            // Assumes a 'feeders' table with 'id' and 'name'
            const { data: feeders, error } = await supabase
                .from('feeders')
                .select('id, name')
                .order('id', { ascending: true });

            if (error) throw error;
            
            if (feeders.length === 0) {
                container.innerHTML = `<span class="col-span-3 text-xs text-gray-500">No feeders found.</span>`;
                return;
            }

            container.innerHTML = feeders.map(feeder => {
                const feederName = feeder.name || `FD-${feeder.id}`;
                return `
                    <button class="feeder-toggle px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium" 
                            data-feeder="${feeder.id}">
                        ${feederName}
                    </button>
                `;
            }).join('');

        } catch (error) {
            console.error("Error fetching feeders:", error.message);
            container.innerHTML = `<span class="col-span-3 text-xs text-red-500">Failed to load feeders.</span>`;
        }
    }

    /**
     * Fetches all outage data from Supabase and stores it in state.
     */
    async function fetchAllOutages() {
        if (!window.supabase) {
            console.error("Supabase client not found.");
            return;
        }
        
        outagesContainer.innerHTML = `<p class="text-center text-gray-500">Loading outages...</p>`;
        emptyState?.classList.add('hidden');

        try {
            const { data, error } = await supabase
                .from('outages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            allOutages = data || [];

        } catch (error) {
            console.error("Error fetching outages:", error.message);
            outagesContainer.innerHTML = `<p class="text-center text-red-500">Failed to load outages: ${error.message}</p>`;
        }
    }

    // ===================================
    // INITIALIZATION
    // ===================================
    async function init() {
        // Connect filter functions to shared.js
        window.filterOutages = applyFiltersAndRender;
        window.applyFilters = applyFiltersAndRender;
        
        // Provide data access for shared.js modal
        window.getOutages = () => allOutages;

        // Page-specific Status filter listener
        const statusFilterElem = document.getElementById("statusFilter");
        statusFilterElem?.addEventListener('change', applyFiltersAndRender);

        attachPostEventListeners();
        
        // Fetch data from Supabase
        await populateFeederFilters();
        await fetchAllOutages();
        
        // Render initial view
        applyFiltersAndRender();
    }

    // ===================================
    // FILTERING LOGIC
    // ===================================
    function applyFiltersAndRender() {
        const feederPopup = document.getElementById("feederPopup");
        const searchInput = document.getElementById("locationSearch");
        const statusFilter = document.getElementById("statusFilter");

        const selectedFeederToggles = feederPopup?.querySelectorAll(".feeder-toggle.bg-blue-500") || [];
        const selectedFeeders = Array.from(selectedFeederToggles).map(btn => btn.dataset.feeder);
        const showAllFeeders = selectedFeeders.length === 0;
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const selectedStatus = statusFilter?.value || 'all';

        currentDisplayData = allOutages.filter(outage => {
            const feederIdString = String(outage.feeder_id);
            const feederMatch = showAllFeeders || selectedFeeders.includes(feederIdString);
            const statusMatch = (selectedStatus === 'all') || (outage.status === selectedStatus);
            const searchableText = [
                outage.title || '',
                outage.description || '',
                ...(outage.affected_areas || [])
            ].join(' ').toLowerCase();
            const searchMatch = (searchTerm === '') || searchableText.includes(searchTerm);
            return feederMatch && statusMatch && searchMatch;
        });

        renderPosts(currentDisplayData);
    }

    // Make applyFiltersAndRender globally available
    window.applyFiltersAndRender = applyFiltersAndRender;

    // ===================================
    // RENDERING FUNCTIONS
    // ===================================
    function renderPosts(outagesToRender) {
        if (!outagesContainer) return;
        if (!Array.isArray(outagesToRender)) { return; }

        if (outagesToRender.length === 0) {
            outagesContainer.innerHTML = '';
            emptyState?.classList.remove('hidden');
        } else {
            emptyState?.classList.add('hidden');
            let postsHTML = '';
            try {
                postsHTML = outagesToRender.map((outage, index) => {
                    try {
                        return renderSinglePostCard(outage);
                    } catch (cardError) {
                        console.error(`ERROR rendering card for outage ID ${outage?.id} (index ${index})`, cardError, outage);
                        return `<div class="p-4 bg-red-100 text-red-700 rounded shadow">Error rendering post ID ${outage?.id || 'Unknown'}. See console.</div>`;
                    }
                }).join('');
                outagesContainer.innerHTML = postsHTML;
            } catch (error) {
                console.error("CRITICAL ERROR during .map() or .join()", error);
                outagesContainer.innerHTML = '<p class="text-red-500">Critical error rendering posts list. Check console.</p>';
            }
        }
    }

    function renderSinglePostCard(outage) {
        if (typeof outage !== 'object' || outage === null) { outage = {}; }
        const status = outage.status || 'Unknown';
        const statusConfig = STATUS_COLORS[status] || STATUS_COLORS.Default;
        const eta = outage.eta ? new Date(outage.eta).toLocaleString() : "To be determined";
        const createdDate = outage.created_at ? new Date(outage.created_at).toLocaleString() : "N/A";
        const hasCoords = outage.latitude && outage.longitude;
        const coordsText = hasCoords ? `${Number(outage.latitude).toFixed(4)}, ${Number(outage.longitude).toFixed(4)}` : 'N/A';
        const hasImages = Array.isArray(outage.images) && outage.images.length > 0;
        const affectedAreasText = Array.isArray(outage.affected_areas) ? outage.affected_areas.join(", ") : 'N/A';
        const outageType = outage.type === 'scheduled' ? 'Scheduled' : 'Unscheduled';

        return `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-t-4 ${statusConfig.border || 'border-gray-500'}">
          <div class="p-4 border-b dark:border-gray-700">
            <div class="flex justify-between items-center gap-4 flex-wrap">
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">${outage.title || 'Outage Report'}</h3>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.tag || ''} flex-shrink-0">${status || 'Unknown'}</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Feeder ${outage.feeder_id || 'N/A'} | ${outageType}</p>
          </div>
          <div class="p-4 space-y-4">
            <p class="text-gray-700 dark:text-gray-300">${outage.description || 'No description provided.'}</p>
            ${hasImages ? `<div><label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pictures</label><div class="flex flex-wrap gap-2">${outage.images.map(img => `<img src="${img || ''}" alt="Outage image" class="w-24 h-24 object-cover rounded-md cursor-pointer hover:opacity-75 view-images-btn" data-src="${img || ''}">`).join('')}</div></div>` : ''}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t dark:border-gray-700">
              <div><label class="block text-xs font-medium text-gray-500 dark:text-gray-400">Affected Areas</label><p class="text-sm text-gray-800 dark:text-gray-200">${affectedAreasText || 'N/A'}</p></div>
              <div><label class="block text-xs font-medium text-gray-500 dark:text-gray-400">ETA</label><p class="text-sm font-bold text-blue-600 dark:text-blue-400">${eta}</p></div>
              <div><label class="block text-xs font-medium text-gray-500 dark:text-gray-400">Coordinates</label>${hasCoords ? `<div class="flex items-center space-x-1"><span class="text-sm text-gray-800 dark:text-gray-200">${coordsText}</span><button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}"><span class="material-icons text-sm">content_copy</span></button></div>` : '<p class="text-sm text-gray-500 dark:text-gray-400">N/A</p>'}</div>
            </div>
          </div>
          <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 flex justify-between items-center flex-wrap gap-2">
            <span class="text-xs text-gray-500 dark:text-gray-400">Reported: ${createdDate}</span>
            <div class="flex space-x-2">
              <button type="button" class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition view-details-btn" data-id="${outage.id || ''}">Details</button>
              <button type="button" class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition update-item-btn" data-id="${outage.id || ''}">Update</button>
            </div>
          </div>
        </div>
        `;
    }

    // ===================================
    // MODALS & ACTIONS (Updated for Unified Modal System)
    // ===================================

    // --- Helper Functions ---
    function handleCopyCoords(e) {
        const btn = e.target.closest('.copy-coords-btn');
        if (!btn) return;
        const coords = btn.dataset.coords;
        if (!coords || coords === 'N/A') return;
        navigator.clipboard.writeText(coords).then(() => {
            window.showSuccessPopup("Coordinates Copied!");
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons text-sm text-green-600">check</span>';
            setTimeout(() => { if (btn && btn.parentNode) btn.innerHTML = originalHTML; }, 2000);
        }).catch(err => console.error('Failed to copy coordinates:', err));
    }

    function hasCoords(outage) { 
        return outage && typeof outage.latitude === 'number' && typeof outage.longitude === 'number'; 
    }

    function showImageModal(imageUrl) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4';
        modal.addEventListener('click', () => modal.remove());
        modal.innerHTML = `
          <div class="relative max-w-3xl max-h-[90vh]">
            <button type="button" class="absolute -top-10 right-0 text-white text-3xl font-bold">&times;</button>
            <img src="${imageUrl || ''}" class="w-full h-auto object-contain max-h-[90vh] rounded-lg">
          </div>`;
        document.body.appendChild(modal);
    }

    // --- Event Listener Setup ---
    function attachPostEventListeners() {
        outagesContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button, img');
            if (!btn) return;
            if (btn.classList.contains('copy-coords-btn')) { 
                handleCopyCoords(e); 
                return; 
            }
            if (btn.classList.contains('view-images-btn')) {
                const imageUrl = btn.dataset.src || btn.src;
                if(imageUrl) showImageModal(imageUrl);
                return;
            }
            const outageId = btn.dataset.id;
            if (!outageId) return;
            const id = parseInt(outageId);
            if (isNaN(id)) { 
                console.error("Invalid outage ID:", outageId); 
                return; 
            }

            if (btn.classList.contains('view-details-btn')) {
                showIndividualDetails(id);
            } else if (btn.classList.contains('update-item-btn')) {
                // Use unified modal system
                window.showUpdateModal([id], 'outages');
            }
        });
    }

    // --- Show Details Modal ---
    function showIndividualDetails(outageId) {
        const outage = allOutages.find(o => o.id === outageId);
        if (!outage) { 
            console.error("Outage not found for ID:", outageId);
            return; 
        }

        const coordsText = hasCoords(outage) ? `${outage.latitude.toFixed(4)}, ${outage.longitude.toFixed(4)}` : 'N/A';
        const statusConfig = STATUS_COLORS[outage.status] || STATUS_COLORS.Default;
        const eta = outage.eta ? new Date(outage.eta).toLocaleString() : "To be determined";
        const createdDate = outage.created_at ? new Date(outage.created_at).toLocaleString() : 'N/A';
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div class="flex justify-between items-center p-6 border-b dark:border-gray-700">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Outage Details #${outage.id}</h3>
                <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal"><span class="material-icons">close</span></button>
              </div>
              <div class="p-6 space-y-4 overflow-y-auto">
                 <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label><p class="text-lg text-gray-900 dark:text-white">${outage.title || 'N/A'}</p></div>
                   <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label><span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${statusConfig.tag || ''}">${outage.status || 'N/A'}</span></div>
                   <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Feeder</label><p class="text-lg text-gray-900 dark:text-white">Feeder ${outage.feeder_id || 'N/A'}</p></div>
                   <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label><p class="text-lg text-gray-900 dark:text-white">${outage.type === 'scheduled' ? 'Scheduled' : 'Unscheduled'}</p></div>
                 </div>
                 <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label><p class="text-gray-900 dark:text-white mt-1">${outage.description || 'No description provided'}</p></div>
                 <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Affected Areas</label><p class="text-gray-900 dark:text-white mt-1">${(Array.isArray(outage.affected_areas) ? outage.affected_areas.join(", ") : 'N/A') || 'N/A'}</p></div>
                 <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">ETA</label><p class="text-lg font-bold text-blue-600 dark:text-blue-400">${eta}</p></div>
                 <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Images</label>${(Array.isArray(outage.images) && outage.images.length > 0) ? `<div class="grid grid-cols-3 gap-2 mt-2">${outage.images.map(img => `<img src="${img}" alt="Report image" class="w-full h-24 object-cover rounded cursor-pointer hover:opacity-75 view-popup-image">`).join('')}</div>` : '<p class="text-gray-500 dark:text-gray-400 mt-1">No images submitted</p>'}</div>
                 <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Coordinates</label>${hasCoords(outage) ? `<div class="flex items-center space-x-2 mt-1"><span class="text-gray-900 dark:text-white">${coordsText}</span><button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}"><span class="material-icons text-sm">content_copy</span></button></div>` : '<p class="text-gray-500 dark:text-gray-400 mt-1">No coordinates submitted</p>'}</div>
                 <div><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Reported At</label><p class="text-gray-900 dark:text-white">${createdDate}</p></div>
              </div>
              <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition close-modal">Close</button>
                <button type="button" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition update-from-details" data-id="${outage.id}">Update</button>
              </div>
            </div>
          `;
        document.body.appendChild(modal);
        
        modal.querySelectorAll('.close-modal').forEach(btn => 
            btn.addEventListener('click', () => modal.remove())
        );
        
        modal.querySelector('.update-from-details').addEventListener('click', function() {
            modal.remove();
            // Use unified modal system
            window.showUpdateModal([outageId], 'outages');
        });
        
        modal.querySelectorAll('.copy-coords-btn').forEach(btn => 
            btn.addEventListener('click', handleCopyCoords)
        );
        
        modal.querySelectorAll('.view-popup-image').forEach(img => 
            img.addEventListener('click', () => showImageModal(img.src))
        );
    }

    // --- Start ---
    init();

}); // End DOMContentLoaded