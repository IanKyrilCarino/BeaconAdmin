// ==========================
// MAP PAGE SCRIPT 
// ==========================
// Loaded LAST only on map.html

// --- Custom Material Icons using L.DivIcon ---
function createMaterialIconHTML(iconName, color) {
    return `<span class="material-icons" style="color: ${color}; font-size: 36px;">${iconName}</span>`;
}

const redMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'red'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

const yellowMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'orange'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

const greenMaterialIcon = L.divIcon({
    html: createMaterialIconHTML('place', 'green'),
    className: 'leaflet-div-icon-material',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38]
});

// Helper function to choose the DivIcon based on status
function getIconForStatus(status) {
    switch (status) {
        case 'Reported':
            return redMaterialIcon;
        case 'Ongoing':
            return yellowMaterialIcon;
        case 'Completed':
            return greenMaterialIcon;
        default:
            return redMaterialIcon;
    }
}


document.addEventListener("DOMContentLoaded", () => {
    const mapContainer = document.getElementById("map");
    if (!mapContainer) return; // Exit if not on Map page

    // --- GLOBAL VARS ---
    let map;
    let allMarkers = []; // To store marker references for filtering

    // --- ELEMENT REFS ---
    const feederPopup = document.getElementById("feederPopup");
    const searchInput = document.getElementById("locationSearch");

    // ===================================
    // 1. MAP INITIALIZATION
    // ===================================
    function initMap() {
        map = L.map('map').setView([16.4142, 120.5950], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // --- Connect to shared.js functions ---
        window.filterMarkers = loadOutageMarkers; 
        window.applyFilters = applyMapFilters; 
        
        // --- Page-specific listeners ---
        setupMapSearchEnterKey();
        
        // Add one listener to the map container for popup buttons
        mapContainer.addEventListener('click', (e) => {
            const updateBtn = e.target.closest('.update-from-map-btn');
            if (updateBtn) {
                const id = parseInt(updateBtn.dataset.id);
                if (!isNaN(id)) {
                    map.closePopup(); // Close the leaflet popup
                    window.showUpdateModal([id], 'outages');
                }
            }
        });

        // --- Load data ---
        populateFeederFilters();
        loadOutageMarkers(); 
    }

    // ===================================
    // 2. DATA LOADING & MARKERS
    // ===================================
    
    /**
     * Fetches all feeder data from Supabase to populate the filter.
     */
    async function populateFeederFilters() {
        const container = document.getElementById("feederButtonContainer");
        if (!container) return;

        container.innerHTML = `<span classclass="col-span-3 text-xs text-gray-500">Loading...</span>`;

        if (!window.supabase) {
            container.innerHTML = `<span class="col-span-3 text-xs text-red-500">Supabase error.</span>`;
            return;
        }

        try {
            const { data: feeders, error } = await supabase
                .from('feeders')
                .select('id, name')
                .order('id', { ascending: true });

            if (error) throw error;
            
            if (feeders.length === 0) {
                container.innerHTML = `<span class="col-span-3 text-xs text-gray-500">No feeders.</span>`;
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
            container.innerHTML = `<span class="col-span-3 text-xs text-red-500">Load error.</span>`;
        }
    }

    /**
     * Fetches and displays outage markers based on the date filter.
     */
    async function loadOutageMarkers() {
        if (!window.supabase) {
            console.error("Supabase client not found.");
            return;
        }
        
        // --- 1. Get Date Filter ---
        const dateInput = document.getElementById("calendarInput");
        const selectedDate = dateInput?.value;
        let todayISO, tomorrowISO;
        
        if (selectedDate) {
            const selectedDay = new Date(selectedDate);
            selectedDay.setHours(0, 0, 0, 0); 
            const nextDay = new Date(selectedDay);
            nextDay.setDate(selectedDay.getDate() + 1);
            todayISO = selectedDay.toISOString();
            tomorrowISO = nextDay.toISOString();
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0); 
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            todayISO = today.toISOString();
            tomorrowISO = tomorrow.toISOString();
        }

        // --- 2. Fetch outages from Supabase ---
        const { data: outages, error } = await supabase
            .from('outages')
            .select('*')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .neq('status', 'Completed') // Exclude completed outages
            .gte('created_at', todayISO)
            .lt('created_at', tomorrowISO);

        if (error) {
            console.error("Error fetching outage markers:", error);
            return;
        }

        // --- 3. Clear previous markers ---
        allMarkers.forEach(markerData => markerData.marker.remove());
        allMarkers = [];

        // --- 4. Create new markers ---
        outages.forEach(outage => {
            const chosenIcon = getIconForStatus(outage.status);
            const marker = L.marker([outage.latitude, outage.longitude], { icon: chosenIcon });
            const popupHTML = createPopupHTML(outage);
            marker.bindPopup(popupHTML);
            allMarkers.push({
                marker: marker,
                searchableText: (outage.title || '').toLowerCase() + ' ' + (outage.affected_areas || []).join(' ').toLowerCase(),
                feeder: outage.feeder_id,
                status: outage.status 
            });
        });

        // 5. Apply the Feeder and Search filters to the newly loaded markers
        applyMapFilters();
    }

    /**
     * Helper: Creates the HTML for the popup "card"
     */
    function createPopupHTML(outage) {
        const eta = outage.eta ? new Date(outage.eta).toLocaleString() : "To be determined";
        const statusClass = outage.status === 'Ongoing' ? 'bg-blue-100 text-blue-800'
                         : outage.status === 'Reported' ? 'bg-red-100 text-red-800'
                         : 'bg-green-100 text-green-800'; 

        return `
            <div class="w-64 font-display">
                <div class="p-2 border-b dark:border-gray-600">
                    <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}">
                        ${outage.status}
                    </span>
                    <h3 class="font-semibold text-gray-800 dark:text-gray-100 mt-1">${outage.title || 'Outage Report'}</h3>
                </div>
                <div class="p-2 space-y-2 text-gray-700 dark:text-gray-300">
                    <div>
                        <label class="text-xs font-medium text-gray-500 dark:text-gray-400">Affected Areas</label>
                        <p class="text-sm">${(outage.affected_areas || []).join(", ")}</p>
                    </div>
                    <div>
                        <label class="text-xs font-medium text-gray-500 dark:text-gray-400">ETA</label>
                        <p class="text-sm font-bold text-blue-600 dark:text-blue-400">${eta}</p>
                    </div>
                </div>
                <div class="p-2 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <button type="button" class="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition w-full update-from-map-btn" data-id="${outage.id}">
                        Update / Announce
                    </button>
                </div>
            </div>
        `;
    }

    // ===================================
    // 3. FILTERING & SEARCH LOGIC (Map-Specific)
    // ===================================

    /**
     * This is the function that shared.js will call via window.applyFilters
     */
    function applyMapFilters() {
        if (!feederPopup || !searchInput) {
             console.warn("Filter elements not found, skipping map filter.");
             return;
        }
        
        const allFeederToggles = feederPopup.querySelectorAll(".feeder-toggle");
        const selectedFeederToggles = feederPopup.querySelectorAll(".feeder-toggle.bg-blue-500");
        const selectedFeeders = Array.from(selectedFeederToggles).map(btn => btn.dataset.feeder);
        const showAllFeeders = selectedFeeders.length === 0 || (allFeederToggles.length > 0 && selectedFeeders.length === allFeederToggles.length);
        const searchTerm = searchInput.value.toLowerCase();

        allMarkers.forEach(markerData => {
            const feederIdString = String(markerData.feeder);
            
            const isFeederVisible = showAllFeeders || selectedFeeders.includes(feederIdString);
            const isSearchMatch = searchTerm === '' || markerData.searchableText.includes(searchTerm);
            const isVisible = isFeederVisible && isSearchMatch;

            if (isVisible) {
                if (!map.hasLayer(markerData.marker)) {
                    markerData.marker.addTo(map);
                }
            } else {
                if (map.hasLayer(markerData.marker)) {
                    markerData.marker.remove();
                }
            }
        });
    }

    /**
     * Listener for Enter key (Jump to location) - This is MAP-SPECIFIC
     */
    function setupMapSearchEnterKey() {
        // The 'input' listener is in shared.js
        
        searchInput.addEventListener("keypress", (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); 
                
                const searchTerm = searchInput.value.toLowerCase();
                const matchingMarker = allMarkers.find(markerData => 
                    markerData.searchableText.includes(searchTerm) && map.hasLayer(markerData.marker)
                );
                
                if (matchingMarker) {
                    map.flyTo(matchingMarker.marker.getLatLng(), 15); // Zoom and pan
                    matchingMarker.marker.openPopup(); // Open the popup
                } else {
                    if (window.showSuccessPopup) {
                        window.showSuccessPopup("No matching outage found in current view."); 
                    }
                }
            }
        });
    }

    // --- START THE MAP ---
    initMap();
});