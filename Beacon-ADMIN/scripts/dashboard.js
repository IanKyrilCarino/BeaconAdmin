// ==========================
// INDEX/DASHBOARD PAGE SCRIPT 
// ==========================

document.addEventListener("DOMContentLoaded", () => {

    // --- DOM Elements ---
    const pieCanvas = document.getElementById('feederChartCanvas');
    const barCanvas = document.getElementById('restorationChartCanvas');
    const reportsTableBody = document.getElementById('reportsBody');
    const totalElement = document.getElementById('value-total');
    const activeElement = document.getElementById('value-active');
    const completedElement = document.getElementById('value-completed');
    
    // ============================================
    // === DATA LOADING FUNCTIONS (Supabase) ===
    // ============================================

    /**
     * Fetches and displays the main dashboard stats (Total, Active, Completed).
     */
    async function loadDashboardStats() {
        if (totalElement) totalElement.textContent = "-";
        if (activeElement) activeElement.textContent = "-";
        if (completedElement) completedElement.textContent = "-";

        if (!window.supabase) return;

        // --- SUPABASE LOGIC TO BE ADDED HERE ---
        // This will involve multiple queries or a Postgres function (rpc)
        // to get counts for 'Total Reports', 'Active Outages', and 'Completed Repairs'.
        //
        // Example (Conceptual):
        // const { data: total, error: totalError } = await supabase
        //   .from('reports')
        //   .select('id', { count: 'exact', head: true });
        //
        // const { data: active, error: activeError } = await supabase
        //   .from('outages')
        //   .eq('status', 'Ongoing')
        //   .select('id', { count: 'exact', head: true });
        //
        // if (totalElement && total) totalElement.textContent = total.count;
        // if (activeElement && active) activeElement.textContent = active.count;

        // For now, we leave the placeholders.
    }

    /**
     * Populates the feeder filter lists from the Supabase 'feeders' table.
     */
    async function populateFeeders(listId) {
        const listContainer = document.getElementById(listId);
        if (!listContainer) {
             console.error(`populateFeeders: Could not find list container #${listId}`);
             return;
        }
        listContainer.innerHTML = `<div class="p-2 text-sm text-gray-500">Loading feeders...</div>`;

        if (!window.supabase) {
            listContainer.innerHTML = `<div class="p-2 text-sm text-red-500">Supabase error</div>`;
            return;
        }

        try {
            // Assumes a table 'feeders' with 'id' (number) and 'name' (string)
            const { data: feeders, error } = await supabase
                .from('feeders')
                .select('id, name')
                .order('name', { ascending: true });

            if (error) throw error;

            listContainer.innerHTML = ""; // Clear loading
            if (feeders.length === 0) {
                listContainer.innerHTML = `<div class="p-2 text-sm text-gray-500">No feeders found.</div>`;
                return;
            }

            feeders.forEach(feeder => {
                const label = document.createElement("label");
                label.className = "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors";
                label.innerHTML = `
                    <input type="checkbox" value="${feeder.id}" checked class="form-checkbox text-blue-600 dark:text-blue-400 feeder-checkbox">
                    <span class="text-sm text-gray-700 dark:text-gray-200">${feeder.name}</span>
                `;
                listContainer.appendChild(label);
            });

        } catch (error) {
            console.error(`Error populating feeders for ${listId}:`, error.message);
            listContainer.innerHTML = `<div class="p-2 text-sm text-red-500">Failed to load feeders.</div>`;
        }
    }

    /**
     * Fetches and displays the 6 most recent outage announcements.
     */
    async function loadRecentReports() {
        if (!reportsTableBody) return;
        
        reportsTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-500 dark:text-gray-400">Loading recent announcements...</td></tr>`;

        if (!window.supabase) {
            reportsTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-red-500">Supabase client not available.</td></tr>`;
            return;
        }

        let recentAnnouncements = [];
        let errorOccurred = false;
        let errorMessage = '';

        try {
            const { data, error } = await supabase
                .from('outages') // Target main outages table
                .select('*')
                .order('created_at', { ascending: false }) // Newest first
                .limit(6); // Limit to 6

            if (error) throw error;
            recentAnnouncements = data || [];
        } catch (error) {
            console.error("Error loading recent announcements:", error);
            errorOccurred = true; errorMessage = `Could not load: ${error.message}`;
        }

        // --- Render Table ---
        reportsTableBody.innerHTML = ""; // Clear loading/previous

        if (errorOccurred) {
            reportsTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-red-500">${errorMessage}</td></tr>`;
        } else if (recentAnnouncements.length === 0) {
            reportsTableBody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-gray-400 dark:text-gray-500">No recent announcements found.</td></tr>`;
        } else {
            recentAnnouncements.forEach(outage => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-700/50";
                const titleOrArea = outage.title || outage.affected_areas?.[0] || 'N/A';
                const feederId = outage.feeder_id || 'N/A';
                const status = outage.status || 'Unknown';

                row.innerHTML = `
                  <td class="py-3 px-4 font-medium">${outage.id || 'N/A'}</td>
                  <td class="py-3 px-4">${titleOrArea}</td>
                  <td class="py-3 px-4">${feederId}</td>
                  <td class="py-3 px-4">${formatTimestamp(outage.created_at)}</td>
                  <td class="py-3 px-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusClass(status)}">
                      ${status}
                    </span>
                  </td>
                  <td class="py-3 px-4 whitespace-nowrap">
                     <a href="outages.html#outage-${outage.id}" title="View details on Outages page"
                        class="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-100 rounded-full hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 transition">
                       View
                     </a>
                  </td>
                `;
                reportsTableBody.appendChild(row);
            });
        }
        
        // Hide pagination controls (dashboard view is not paginated)
        const paginationDiv = document.getElementById('prevPage')?.closest('div.flex');
        if (paginationDiv) paginationDiv.classList.add('hidden');
    }

    // ============================================
    // === CHART & UI LOGIC (Client-Side) ===
    // ============================================
    
    /** Placeholder for feeder chart update logic */
    function updateFeederChart() {
        if (!pieCanvas) return;
        const listContainer = document.getElementById("feederList");
        if (!listContainer) return;
        const checked = Array.from(listContainer.querySelectorAll("input.feeder-checkbox:checked")).map(cb => cb.value);
        
        // --- ADD SUPABASE QUERY & CHART.JS LOGIC HERE ---
        // e.g., fetch report counts grouped by feeder_id
        // using the 'checked' array as a filter.
    }
    
    /** Placeholder for restoration chart update logic */
    function updateRestorationChart() {
        if (!barCanvas) return;
        const listContainer = document.getElementById("restorationFeederList");
        if (!listContainer) return;
        const checked = Array.from(listContainer.querySelectorAll("input.feeder-checkbox:checked")).map(cb => cb.value);
        
        // --- ADD SUPABASE QUERY & CHART.JS LOGIC HERE ---
        // e.g., fetch avg restoration time grouped by feeder_id
        // using the 'checked' array as a filter.
    }
    
    /** Helper: Get Status Badge Class */
    function getStatusClass(status) {
        // Relies on global window.STATUS_COLORS if available, otherwise defaults
        const config = window.STATUS_COLORS ? window.STATUS_COLORS[status] : null;
        return config ? config.tag : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"; // Default gray
    }

    /** Helper: Format Date */
    function formatTimestamp(isoString) {
      if (!isoString) return 'N/A';
      try {
          return new Date(isoString).toLocaleString('en-US', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
          });
      } catch (e) { return 'Invalid Date'; }
    }
    
    /** Helper: Update chart filter label */
    function updateChartLabel(listId, labelId) {
        const listContainer = document.getElementById(listId);
        const labelEl = document.getElementById(labelId);
        if (!listContainer || !labelEl) return;
        const checkedCheckboxes = listContainer.querySelectorAll("input.feeder-checkbox:checked");
        const checkedCount = checkedCheckboxes.length;
        const totalCount = listContainer.querySelectorAll("input.feeder-checkbox").length;

        if (checkedCount === 0) labelEl.textContent = "No feeders selected";
        else if (checkedCount === totalCount) labelEl.textContent = "All feeders selected";
        else {
             const names = Array.from(checkedCheckboxes).slice(0, 3).map(cb => cb.closest('label').querySelector('span').textContent);
             labelEl.textContent = names.join(", ") + (checkedCount > 3 ? ` + ${checkedCount - 3} more` : '');
        }
    }

    /** Helper: Setup filter button listeners */
    function setupFilterButton(buttonId, popupId, selectAllId, clearId, applyId, listId, labelId, chartUpdateFn) {
        const button = document.getElementById(buttonId);
        const popup = document.getElementById(popupId);
        const selectAllBtn = document.getElementById(selectAllId);
        const clearBtn = document.getElementById(clearId);
        const applyBtn = document.getElementById(applyId);
        const listContainer = document.getElementById(listId);

        if (!button || !popup || !listContainer) {
             console.error(`setupFilterButton: Missing critical elements for ${buttonId}`);
             return;
        }

        if (typeof window.setupDropdownToggle === 'function') {
            window.setupDropdownToggle(buttonId, popupId);
        } else {
            console.error("setupDropdownToggle function not found in shared.js");
        }

        if (selectAllBtn) {
            selectAllBtn.addEventListener("click", (e) => {
                e.stopPropagation(); 
                listContainer.querySelectorAll("input.feeder-checkbox").forEach(cb => cb.checked = true);
                updateChartLabel(listId, labelId);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                listContainer.querySelectorAll("input.feeder-checkbox").forEach(cb => cb.checked = false);
                updateChartLabel(listId, labelId);
            });
        }

        if (applyBtn) {
            applyBtn.addEventListener("click", () => {
                popup.classList.add('hidden'); 
                updateChartLabel(listId, labelId); 
                if (typeof chartUpdateFn === 'function') {
                    chartUpdateFn(); 
                }
            });
        }

        listContainer.addEventListener("change", (e) => {
             if (e.target.classList.contains('feeder-checkbox')) {
                 updateChartLabel(listId, labelId);
             }
        });
    }

    // ============================================
    // === INITIALIZATION ===
    // ============================================
    
    async function initDashboard() {
        // Setup static UI listeners first
        setupFilterButton(
            "feederFilterBtn", "feederFilterPopup",
            "feederSelectAll", "feederClear", "feederApply",
            "feederList", "feederChartLabel",
            updateFeederChart
        );
        setupFilterButton(
            "restorationFilterBtn", "restorationFilterPopup",
            "restorationSelectAll", "restorationClear", "restorationApply",
            "restorationFeederList", "restorationChartLabel",
            updateRestorationChart
        );
        
        // Fetch dynamic data
        await loadDashboardStats();
        await loadRecentReports();
        
        // Populate feeders, which will then trigger initial label updates
        await populateFeeders("feederList");
        await populateFeeders("restorationFeederList");
        
        // Update labels *after* feeders are populated
        updateChartLabel("feederList", "feederChartLabel");
        updateChartLabel("restorationFeederList", "restorationChartLabel");

        // Run initial chart queries
        updateFeederChart();
        updateRestorationChart();
    }

    // Run the dashboard initialization
    initDashboard();
    
}); // End DOMContentLoaded