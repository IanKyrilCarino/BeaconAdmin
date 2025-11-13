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

    // ==============================
    // DASHBOARD.JS
    // ==============================

    // ---  HEAT MAP ---
    const map = L.map('map').setView([16.4023, 120.5960], 13); // Center on Baguio

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // --- Heatmap layer ---
    let heatLayer = null;

    // --- Current heatmap filter ---
    // Default to 'all' so any existing points are visible immediately
    let heatFilter = 'all';

    // --- Status weight mapping (intensity) ---
    const STATUS_WEIGHT = {
    pending: 1,
    reported: 2,
    ongoing: 3
    };

    // --- Fetch reports and update heatmap ---
    async function fetchReports() {
    const { data, error } = await supabase
        .from('reports')
        .select('latitude, longitude, status');

    if (error) {
        console.error('Supabase error:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No reports found.');
        return;
    }

    // Define allowed statuses based on toggle
    const allowedStatuses = heatFilter === 'all'
        ? ['pending', 'reported', 'ongoing']
        : heatFilter === 'reported_ongoing'
        ? ['reported', 'ongoing']
        : ['pending'];

    // Prepare heatmap data
    const heatData = data
        .filter(r => r.latitude && r.longitude)
        .filter(r => allowedStatuses.includes(r.status.toLowerCase()))
        .map(r => [Number(r.latitude), Number(r.longitude), STATUS_WEIGHT[r.status.toLowerCase()] || 1]);

    // Remove previous layer
    if (heatLayer) heatLayer.remove();

    // Add new heatmap layer
    heatLayer = L.heatLayer(heatData, { radius: 25, blur: 15 }).addTo(map);
    }

    // --- Initial load + periodic refresh ---
    fetchReports();
    setInterval(fetchReports, 30000); // refresh every 30s

    // --- Toggle button logic ---
    const filterBtn = document.getElementById('heatmapFilterBtn');
    const filterPopup = document.getElementById('heatmapFilterPopup');
    const filterRadios = filterPopup.querySelectorAll('input[name="heatmapFilter"]');

    // Show/hide popup on button click
    filterBtn.addEventListener('click', () => {
    filterPopup.classList.toggle('hidden');
    });

    // Update heatmap when a filter is selected
    filterRadios.forEach(radio => {
    radio.addEventListener('change', e => {
        heatFilter = e.target.value;
        
        // Update button label dynamically
        const labelText = e.target.nextElementSibling.textContent;
        const spans = filterBtn.querySelectorAll('span');
        if (spans.length > 1) spans[1].textContent = labelText;

        fetchReports(); // refresh heatmap
        filterPopup.classList.add('hidden'); // close popup
    });
    });

    // Close popup when clicking outside
    document.addEventListener('click', e => {
    if (!filterPopup.contains(e.target) && !filterBtn.contains(e.target)) {
        filterPopup.classList.add('hidden');
    }
    });



    // ============================================
    // === DATA LOADING FUNCTIONS (Supabase) ===
    // ============================================

    /**
     * Fetches and displays the main dashboard stats (Total, Active, Completed).
     */
    async function loadDashboardStats() {
    if (!window.supabase) return;

    try {
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        const formatDate = d => d.toISOString().split('T')[0];

        const todayStart = formatDate(today) + "T00:00:00Z";
        const todayEnd = formatDate(today) + "T23:59:59Z";
        const yesterdayStart = formatDate(yesterday) + "T00:00:00Z";
        const yesterdayEnd = formatDate(yesterday) + "T23:59:59Z";

        // --- Fetch counts ---
        const counts = {};

        // Total reports
        const { count: totalToday } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', todayStart)
            .lte('created_at', todayEnd);

        const { count: totalYesterday } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', yesterdayStart)
            .lte('created_at', yesterdayEnd);

        counts.total = { today: totalToday, yesterday: totalYesterday };

        // Active / Ongoing
        const { count: activeToday } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Ongoing')
            .gte('created_at', todayStart)
            .lte('created_at', todayEnd);

        const { count: activeYesterday } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Ongoing')
            .gte('created_at', yesterdayStart)
            .lte('created_at', yesterdayEnd);

        counts.active = { today: activeToday, yesterday: activeYesterday };

        // Completed
        const { count: completedToday } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Completed')
            .gte('updated_at', todayStart)
            .lte('updated_at', todayEnd);

        const { count: completedYesterday } = await supabase
            .from('announcements')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Completed')
            .gte('updated_at', yesterdayStart)
            .lte('updated_at', yesterdayEnd);

        counts.completed = { today: completedToday, yesterday: completedYesterday };

        // --- Helper: compute percent ---
        const computePercent = (todayVal, yesterdayVal) => {
            if (yesterdayVal === 0) return 100;
            return ((todayVal - yesterdayVal) / yesterdayVal) * 100;
        };

        // --- Helper: update tile ---
        const updateTile = (valueId, trendId, iconId, todayVal, yesterdayVal) => {
            const valueEl = document.getElementById(valueId);
            const trendEl = document.getElementById(trendId);
            const iconEl = document.getElementById(iconId);

            if (valueEl) valueEl.textContent = todayVal ?? 0;

            const percent = computePercent(todayVal, yesterdayVal).toFixed(1);
            let arrow = '';
            let colorClass = '';

            if (percent > 0) {
                arrow = 'arrow_upward';
                colorClass = 'text-red-600';
            } else if (percent < 0) {
                arrow = 'arrow_downward';
                colorClass = 'text-green-600';
            } else {
                arrow = '';
                colorClass = 'text-gray-500';
            }

            if (iconEl) {
                iconEl.textContent = arrow;
                iconEl.className = `material-icons text-sm ${colorClass}`;
            }

            if (trendEl) {
                const percentText = percent === 0 ? '0%' : Math.abs(percent) + '%';
                trendEl.querySelector('span:last-child').textContent = percentText;
                trendEl.querySelector('span:last-child').className = `text-sm font-medium ${colorClass}`;
            }
        };

        // --- Update each tile ---
        updateTile('value-total', 'trend-total', 'icon-total', counts.total.today, counts.total.yesterday);
        updateTile('value-active', 'trend-active', 'icon-active', counts.active.today, counts.active.yesterday);
        updateTile('value-completed', 'trend-completed', 'icon-completed', counts.completed.today, counts.completed.yesterday);

    } catch (error) {
        console.error("Error loading dashboard stats:", error);
        if (totalElement) totalElement.textContent = "Err";
        if (activeElement) activeElement.textContent = "Err";
        if (completedElement) completedElement.textContent = "Err";
    }
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
            // === UPDATED - Changed 'outages' to 'announcements' ===
            // This query now targets the 'announcements' table as per your schema
            const { data, error } = await supabase
                .from('announcements') // Was 'outages', now 'announcements'
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
                
                // === UPDATED - Field name changed ===
                // 'title' does not exist in your 'announcements' schema.
                // We will use 'cause' or 'location' instead.
                const titleOrArea = outage.cause || outage.location || outage.areas_affected?.[0] || 'N/A';
                // === END OF UPDATE ===
                
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
    }

    // ============================================
    // === CHART & UI LOGIC (Client-Side) ===
    // ============================================
    
    /** * Fetches feeder data and updates the pie chart.
     * === UPDATED - This function is now fully implemented ===
     */
    
    let feederChart, restorationChart;

    document.addEventListener('DOMContentLoaded', async () => {
    // Get canvas contexts
    const feederCtx = document.getElementById('feederChartCanvas').getContext('2d');
    const restorationCtx = document.getElementById('restorationChartCanvas').getContext('2d');

    // Initialize charts
    feederChart = new Chart(feederCtx, {
        type: 'bar',
        data: {
        labels: [],
        datasets: [{
            label: 'Announcements per Feeder',
            data: [],
            backgroundColor: '#3B82F6',
            borderRadius: 5
        }]
        },
        options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
        }
    });

    restorationChart = new Chart(restorationCtx, {
        type: 'bar',
        data: {
        labels: [],
        datasets: [{
            label: 'Avg Restoration Time (hrs)',
            data: [],
            backgroundColor: '#10B981',
            borderRadius: 5
        }]
        },
        options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
        }
    });

    // 3️⃣ Load data and update charts
    await loadCharts();
    });

    // 4️⃣ Load announcements and update charts
    async function loadCharts() {
    const { data: announcements, error } = await supabase
        .from('announcements')
        .select('id, feeder, created_at, restored_at'); // use created_at

    if (error) return console.error('Error fetching announcements:', error);

    const feederMap = {};
    const restorationMap = {};

    announcements.forEach(a => {
        const feeder = a.feeder || 'Unknown';

        // Count announcements per feeder
        feederMap[feeder] = (feederMap[feeder] || 0) + 1;

        // Calculate restoration time only if restored_at exists
        if (a.restored_at) {
        const hours = (new Date(a.restored_at) - new Date(a.created_at)) / (1000 * 60 * 60);
        if (!restorationMap[feeder]) restorationMap[feeder] = [];
        restorationMap[feeder].push(hours);
        }
    });

    const labels = Object.keys(feederMap);

    // Update feeder chart
    feederChart.data.labels = labels;
    feederChart.data.datasets[0].data = labels.map(f => feederMap[f]);
    feederChart.update();

    // Update restoration chart (average per feeder)
    restorationChart.data.labels = labels;
    restorationChart.data.datasets[0].data = labels.map(f => {
        const times = restorationMap[f] || [];
        return times.length ? (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2) : 0;
    });
    restorationChart.update();
    }
    
    async function updateFeederChart() {
        if (!pieCanvas) return;
        const listContainer = document.getElementById("feederList");
        if (!listContainer) return;
        
        const checked = Array.from(listContainer.querySelectorAll("input.feeder-checkbox:checked")).map(cb => cb.value);
        
        if (checked.length === 0) {
            if (feederChartInstance) feederChartInstance.destroy();
            pieCanvas.getContext('2d').fillText("No feeders selected.", 10, 50);
            return;
        }

        try {
            // 1. Fetch announcement data, joining with the feeder name
            const { data, error } = await supabase
                .from('announcements')
                .select('feeder_id, feeders ( name )') // Select feeder_id and the related feeder's name
                .in('feeder_id', checked);

            if (error) throw error;

            // 2. Process data in JS to get counts
            const feederCounts = data.reduce((acc, { feeder_id, feeders }) => {
                if (!feeders) return acc; // Skip if join failed (e.g., null feeder_id)
                const name = feeders.name || `Feeder ${feeder_id}`;
                acc[name] = (acc[name] || 0) + 1;
                return acc;
            }, {});

            const labels = Object.keys(feederCounts);
            const values = Object.values(feederCounts);

            // 3. Render with Chart.js
            const chartData = {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1', '#EC4899'], // Example colors
                }]
            };

            if (feederChartInstance) {
                feederChartInstance.destroy(); // Destroy old chart
            }

            feederChartInstance = new Chart(pieCanvas, {
                type: 'pie', // or 'doughnut'
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: document.body.classList.contains('dark') ? '#E5E7EB' : '#374151'
                            }
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Error updating feeder chart:", error.message);
            pieCanvas.getContext('2d').fillText(`Error: ${error.message}`, 10, 50);
        }
    }
    // === END OF UPDATE ===
    
    /** * Fetches restoration data and updates the bar chart.
     * === UPDATED - This function is now fully implemented ===
     */
    async function updateRestorationChart() {
        if (!barCanvas) return;
        const listContainer = document.getElementById("restorationFeederList");
        if (!listContainer) return;
        
        const checked = Array.from(listContainer.querySelectorAll("input.feeder-checkbox:checked")).map(cb => cb.value);

        if (checked.length === 0) {
            if (restorationChartInstance) restorationChartInstance.destroy();
            barCanvas.getContext('2d').fillText("No feeders selected.", 10, 50);
            return;
        }

        try {
            // 1. Fetch completed announcements with timestamps and feeder names
            const { data, error } = await supabase
                .from('announcements')
                .select('created_at, estimated_restoration_at, updated_at, status, feeder_id, feeders ( name )')
                .in('feeder_id', checked)
                .eq('status', 'Completed') // Only get completed ones
                .not('estimated_restoration_at', 'is', null); // Ensure ETA was set

            if (error) throw error;

            // 2. Process data to get average restoration time
            const feederTimes = data.reduce((acc, item) => {
                if (!item.feeders) return acc; // Skip
                
                const name = item.feeders.name || `Feeder ${item.feeder_id}`;
                if (!acc[name]) {
                    acc[name] = { totalDuration: 0, count: 0 };
                }

                // Calculate duration in hours
                // Use 'updated_at' as the actual completion time
                const startTime = new Date(item.created_at);
                const endTime = new Date(item.updated_at); // Use updated_at for when it was marked 'Completed'
                const durationMs = endTime - startTime;
                const durationHours = durationMs / (1000 * 60 * 60);

                if (durationHours > 0 && durationHours < 1000) { // Basic sanity check
                    acc[name].totalDuration += durationHours;
                    acc[name].count += 1;
                }
                return acc;
            }, {});

            // 3. Finalize averages
            const labels = Object.keys(feederTimes);
            const values = labels.map(label => {
                const { totalDuration, count } = feederTimes[label];
                return count > 0 ? (totalDuration / count).toFixed(2) : 0; // Calculate average
            });
            
            // 4. Render with Chart.js
            if (restorationChartInstance) {
                restorationChartInstance.destroy(); // Destroy old chart
            }
            
            const isDark = document.body.classList.contains('dark');
            const gridColor = isDark ? '#4B5563' : '#E5E7EB';
            const textColor = isDark ? '#E5E7EB' : '#374151';

            restorationChartInstance = new Chart(barCanvas, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Avg. Restoration Time (Hours)',
                        data: values,
                        backgroundColor: '#3B82F6',
                        borderColor: '#3B82F6',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: textColor }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false // Hide legend for a cleaner bar chart
                        }
                    }
                }
            });

        } catch (error) {
            console.error("Error updating restoration chart:", error.message);
            barCanvas.getContext('2d').fillText(`Error: ${error.message}`, 10, 50);
        }
    }
    // === END OF UPDATE ===
    
    /** Helper: Get Status Badge Class */
    /** Helper: Get Status Badge Class */
    function getStatusClass(status) {
        switch ((status || '').toLowerCase()) {
            case 'reported':
                return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
            case 'ongoing':
                return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
            case 'completed':
                return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
            default:
                return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
        }
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

        if (totalCount === 0) {
            labelEl.textContent = "Loading feeders..."; // Label before feeders are loaded
            return;
        }
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
                 // Don't update chart on every click, just update label
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
        // We use Promise.all to run these in parallel for faster loading
        await Promise.all([
            loadDashboardStats(),
            loadRecentReports(),
            populateFeeders("feederList"),
            populateFeeders("restorationFeederList")
        ]);
        
        // Update labels *after* feeders are populated
        updateChartLabel("feederList", "feederChartLabel");
        updateChartLabel("restorationFeederList", "restorationChartLabel");

        // Run initial chart queries now that everything is loaded
        updateFeederChart();
        updateRestorationChart();
    }

    // Run the dashboard initialization
    initDashboard();
    
}); // End DOMContentLoaded

