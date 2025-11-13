// ==========================
// OUTAGES PAGE SCRIPT (v7 - Schema Update)
// ==========================
// Loaded LAST only on outages.html

document.addEventListener("DOMContentLoaded", () => {

    // --- Essential Elements ---
    const outagesContainer = document.getElementById("outagesContainer");
    const emptyState = document.getElementById("emptyState");

    if (!outagesContainer) {
        console.error("CRITICAL ERROR v4.1: Outages container (#outagesContainer) not found!");
        return;
    }
    if (!emptyState) {
        console.warn("WARN v4.1: Empty state element (#emptyState) not found.");
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
            // =================================================================
            // ✅ MODIFICATION: Updated query to fetch from announcement_images
            // =================================================================
            const { data, error } = await supabase
                .from('announcements')
                .select(`
                    *,
                    title:location,
                    eta:estimated_restoration_at,
                    affected_areas:areas_affected,
                    announcement_images ( id, image_url )
                `)
                .order('created_at', { ascending: false });
            // =================================================================
            // ✅ END MODIFICATION
            // =================================================================

            if (error) throw error;

            // =================================================================
            // ✅ MODIFICATION: Map data to create the `images` array
            // The rest of the script (renderers) expects `outage.images`
            // to be a simple array of URLs.
            // =================================================================
            allOutages = data ? data.map(outage => {
                // Get URLs from the new related table
                const newImageUrls = outage.announcement_images 
                    ? outage.announcement_images.map(img => img.image_url) 
                    : [];
                
                // Fallback for any URLs still in the old 'pictures' or 'picture' columns
                const oldImageUrls = Array.isArray(outage.pictures) ? outage.pictures : [];
                const singleImageUrl = outage.picture ? [outage.picture] : [];
                
                // Combine all and remove duplicates
                const allImageUrls = [
                    ...new Set([
                        ...newImageUrls, 
                        ...oldImageUrls, 
                        ...singleImageUrl
                    ])
                ];

                return {
                    ...outage,
                    images: allImageUrls // This `images` property is used by render functions
                };
            }) : [];
            // =================================================================
            // ✅ END MODIFICATION
            // =================================================================


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
            
            // 'outage.title' is now correctly mapped from the 'location' column
            // 'outage.affected_areas' is now correctly mapped from the 'areas_affected' column
            const searchableText = [
                outage.title || '', // This is now outage.location
                outage.description || '',
                ...(outage.affected_areas || []) // This is now outage.areas_affected
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
        const outageType = outage.type === 'scheduled' ? 'Scheduled' : 'Unscheduled';

        // Handle images dynamically: show full image without cropping
        // This code works AS-IS because `fetchAllOutages` now correctly
        // populates `outage.images` as an array of URLs.
        const hasImages = Array.isArray(outage.images) && outage.images.length > 0;
        const imageHTML = hasImages ? `
            <div class="w-full mb-4">
                <label class="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Pictures</label>
                <div class="w-full overflow-hidden rounded-md">
                    ${outage.images.map((img, idx) => `
                        <img src="${img || ''}" alt="Outage image ${idx+1}" 
                            class="w-full h-auto rounded-md mb-2">
                    `).join('')}
                </div>
            </div>
        ` : '';

        // Show only the first affected area
        let affectedAreaText = 'N/A';
        if (Array.isArray(outage.affected_areas) && outage.affected_areas.length > 0) {
            affectedAreaText = outage.affected_areas[0];
            if (outage.affected_areas.length > 1) {
                affectedAreaText += ` (+${outage.affected_areas.length - 1} more)`;
            }
        }

        return `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-md border-t-4 ${statusConfig.border} w-[650px] mx-auto mb-6 p-4 flex flex-col">
            <div class="flex justify-between items-center flex-wrap gap-2 mb-2">
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white">
                    ${outage.cause ? outage.cause : 'Outage Report'}${outage.location ? ` at ${outage.location}` : ''}
                </h3>
                <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusConfig.tag} flex-shrink-0">${status}</span>
            </div>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Feeder ${outage.feeder_id || 'N/A'} | ${outageType}</p>
            
            <p class="text-gray-700 dark:text-gray-300 mb-4">${outage.description || 'No description provided.'}</p>

            ${imageHTML}

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t dark:border-gray-700">
                <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">Affected Area</label>
                    <p class="text-sm text-gray-800 dark:text-gray-200">${affectedAreaText}</p>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">ETA</label>
                    <p class="text-sm font-bold text-blue-600 dark:text-blue-400">${eta}</p>
                </div>
                <div>
                    <label class="block text-xs font-medium text-gray-500 dark:text-gray-400">Coordinates</label>
                    ${hasCoords ? `<div class="flex items-center space-x-1">
                        <span class="text-sm text-gray-800 dark:text-gray-200">${coordsText}</span>
                        <button type="button" class="text-blue-600 dark:text-blue-400 hover:underline copy-coords-btn" data-coords="${coordsText}">
                            <span class="material-icons text-sm">content_copy</span>
                        </button>
                    </div>` : '<p class="text-sm text-gray-500 dark:text-gray-400">N/A</p>'}
                </div>
            </div>

            <div class="flex justify-end space-x-2 mt-4">
                <button type="button" class="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition view-details-btn" data-id="${outage.id || ''}">Details</button>
                <button type="button" class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition update-item-btn" data-id="${outage.id || ''}">Update</button>
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

        // Use document.execCommand for simple clipboard access in iFrames
        try {
            const tempInput = document.createElement("textarea");
            tempInput.style.position = "absolute";
            tempInput.style.left = "-9999px";
            tempInput.value = coords;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
            
            window.showSuccessPopup("Coordinates Copied!");
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<span class="material-icons text-sm text-green-600">check</span>';
            setTimeout(() => { if (btn && btn.parentNode) btn.innerHTML = originalHTML; }, 2000);
        } catch (err) {
            console.error('Failed to copy coordinates:', err);
            window.showErrorPopup("Failed to copy. See console.");
        }
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
                // This is consistent with shared.js
                window.showUpdateModal([id], 'outages');
            }
        });
    }
// --- Show Details Modal ---
function showIndividualDetails(outageId) {
    // This function works AS-IS because `fetchAllOutages`
    // correctly populates `allOutages` with the `images` array.
    const outage = allOutages.find(o => o.id === outageId);
    if (!outage) {
        console.error("Outage not found for ID:", outageId);
        return;
    }

    const coordsText = hasCoords(outage) ? `${outage.latitude.toFixed(4)}, ${outage.longitude.toFixed(4)}` : 'N/A';
    const statusConfig = STATUS_COLORS[outage.status] || STATUS_COLORS.Default;

    const eta = outage.eta ? new Date(outage.eta).toLocaleString() : "To be determined";
    const createdDate = outage.created_at ? new Date(outage.created_at).toLocaleString() : 'N/A';

    const hasImages = Array.isArray(outage.images) && outage.images.length > 0;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
          <div class="w-full h-2 ${statusConfig.border}"></div>

          <div class="flex justify-between items-start p-6 border-b dark:border-gray-700">
            <div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white">${outage.cause || 'Outage'}${outage.location ? ' at ' + outage.location : ''}</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Reported At: ${createdDate}</p>
            </div>
            <button type="button" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 close-modal">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="p-6 space-y-4 overflow-y-auto">
            ${hasImages ? `
            <div class="w-full flex justify-center bg-white dark:bg-gray-800 rounded-lg p-4 shadow mb-4">
              <div class="relative w-full max-w-2xl h-64 md:h-96 overflow-hidden rounded-lg">
                ${outage.images.map((img, idx) => `
                  <img src="${img}" alt="Outage image ${idx+1}" class="absolute top-0 left-0 w-full h-full object-contain transition-opacity duration-500 ${idx === 0 ? 'opacity-100' : 'opacity-0'} carousel-image" data-index="${idx}">
                `).join('')}
                <button type="button" class="absolute top-1/2 left-2 -translate-y-1/2 bg-gray-200 dark:bg-gray-700 bg-opacity-50 rounded-full px-2 py-1 carousel-prev">
                  <span class="material-icons text-sm">chevron_left</span>
                </button>
                <button type="button" class="absolute top-1/2 right-2 -translate-y-1/2 bg-gray-200 dark:bg-gray-700 bg-opacity-50 rounded-full px-2 py-1 carousel-next">
                  <span class="material-icons text-sm">chevron_right</span>
                </button>
              </div>
            </div>` : ''}

            <div class="grid grid-cols-3 gap-4 text-sm font-medium">
              <div>Status: <span class="${statusConfig.tag} px-2 py-0.5 rounded">${outage.status || 'N/A'}</span></div>
              <div>Feeder: ${outage.feeder_id || 'N/A'}</div>
              <div>Type: ${outage.type === 'scheduled' ? 'Scheduled' : 'Unscheduled'}</div>
            </div>

            <div class="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <p class="text-gray-900 dark:text-white">${outage.description || 'No description provided.'}</p>
            </div>

            <div class="flex items-center gap-2 text-sm font-medium cursor-pointer affected-areas-toggle">
              <span class="text-gray-900 dark:text-white">Affected Areas</span>
              <span class="material-icons text-base transition-transform duration-200">expand_more</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 affected-areas-content hidden"></div>

            <div class="grid grid-cols-2 gap-4 text-sm font-medium mt-4">
              <div>ETA: ${eta}</div>
              <div>Coordinates: ${coordsText}</div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <button type="button" class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition close-modal">Close</Same</button>
            <button type="button" class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition update-from-details" data-id="${outage.id}">Update</button>
          </div>
        </div>
    `;
    document.body.appendChild(modal);

    // CLOSE MODAL
    modal.querySelectorAll('.close-modal').forEach(btn =>
        btn.addEventListener('click', () => modal.remove())
    );

    // UPDATE BUTTON
    modal.querySelector('.update-from-details').addEventListener('click', function () {
        modal.remove();
        // This correctly calls the unified modal from shared.js
        window.showUpdateModal([outageId], 'outages');
    });

    // AFFECTED AREAS DROPDOWN LOGIC
    const toggle = modal.querySelector('.affected-areas-toggle');
    const content = modal.querySelector('.affected-areas-content');
    const arrowIcon = toggle.querySelector('.material-icons');
    let isOpen = false;

    toggle.addEventListener('click', () => {
        if (!isOpen) {
            content.innerHTML = (Array.isArray(outage.affected_areas) ? outage.affected_areas : []).map(area => `
                <span class="inline-block bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white rounded-full px-3 py-1 text-xs">${area}</span>
            `).join('');
            content.classList.remove('hidden');
            arrowIcon.classList.add('rotate-180');
        } else {
            content.classList.add('hidden');
            arrowIcon.classList.remove('rotate-180');
        }
        isOpen = !isOpen;
    });

    // IMAGE CAROUSEL POPUP
    modal.querySelectorAll('.view-popup-image').forEach(img =>
        img.addEventListener('click', () => showImageModal(img.src))
    );
}

    // --- Start ---
    init();

}); // End DOMContentLoaded