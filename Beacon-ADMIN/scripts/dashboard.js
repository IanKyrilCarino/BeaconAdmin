// ==========================
// DASHBOARD.JS (Updated with Advanced Analytics)
// ==========================

document.addEventListener("DOMContentLoaded", () => {

    // --- Global Chart Instances ---
    let feederChartInstance = null;
    let restorationChartInstance = null;
    let rootCauseInstance = null;
    let barangayImpactInstance = null;
    let peakTimeInstance = null;
    let mttrTrendInstance = null;

    // --- DOM Elements ---
    const pieCanvas = document.getElementById('feederChartCanvas');
    const barCanvas = document.getElementById('restorationChartCanvas');
    const reportsTableBody = document.getElementById('reportsBody');
    
    // Date Filter Elements
    const dateDropdownBtn = document.getElementById('dateDropdownBtn');
    const calendarDropdown = document.getElementById('calendarDropdown');
    const applyDateBtn = document.getElementById('applyDateBtn');
    const calendarInput = document.getElementById('calendarInput');
    const selectedDateLabel = document.getElementById('selectedDate');

    // ==============================
    // 1. MAP & HEATMAP LOGIC
    // ==============================
    
    const map = L.map('map').setView([16.4023, 120.5960], 13); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    let heatLayer = null;
    let heatFilter = 'pending'; 

    const heatFilterLabel = document.querySelector('#heatmapFilterBtn span:nth-child(2)'); 
    if(heatFilterLabel) heatFilterLabel.textContent = "Pending only";

    async function fetchHeatmapData() {
        let heatPoints = [];
        const STATUS_WEIGHT = { pending: 1, reported: 2, ongoing: 3 };

        try {
            // Pending
            if (heatFilter === 'pending' || heatFilter === 'all') {
                const { data: reportsData, error: reportsError } = await supabase
                    .from('reports')
                    .select('latitude, longitude, status')
                    .eq('status', 'pending');

                if (!reportsError && reportsData) {
                    const points = reportsData
                        .filter(r => r.latitude && r.longitude)
                        .map(r => [Number(r.latitude), Number(r.longitude), STATUS_WEIGHT.pending]);
                    heatPoints = heatPoints.concat(points);
                }
            }

            // Reported/Ongoing
            if (heatFilter === 'reported_ongoing' || heatFilter === 'all') {
                const { data: annData, error: annError } = await supabase
                    .from('announcements')
                    .select('latitude, longitude, status') 
                    .in('status', ['Ongoing', 'Reported']);

                if (!annError && annData) {
                    const points = annData
                        .filter(r => r.latitude && r.longitude)
                        .map(r => [
                            Number(r.latitude), 
                            Number(r.longitude), 
                            STATUS_WEIGHT[r.status.toLowerCase()] || 2
                        ]);
                    heatPoints = heatPoints.concat(points);
                }
            }

            if (heatLayer) heatLayer.remove();
            if (heatPoints.length > 0) {
                heatLayer = L.heatLayer(heatPoints, { radius: 25, blur: 15 }).addTo(map);
            }

        } catch (err) {
            console.error("Error updating heatmap:", err);
        }
    }

    fetchHeatmapData();
    setInterval(fetchHeatmapData, 30000); 

    const hFilterBtn = document.getElementById('heatmapFilterBtn');
    const hFilterPopup = document.getElementById('heatmapFilterPopup');
    const hFilterRadios = hFilterPopup ? hFilterPopup.querySelectorAll('input[name="heatmapFilter"]') : [];

    if(hFilterBtn) {
        hFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            hFilterPopup.classList.toggle('hidden');
        });
    }

    hFilterRadios.forEach(radio => {
        radio.addEventListener('change', e => {
            heatFilter = e.target.value;
            const labelText = e.target.nextElementSibling.textContent;
            const spans = hFilterBtn.querySelectorAll('span');
            if (spans.length > 1) spans[1].textContent = labelText;
            fetchHeatmapData(); 
            hFilterPopup.classList.add('hidden');
        });
    });

    // ==============================
    // 2. DATE FILTER & STATS
    // ==============================

    if (dateDropdownBtn && calendarDropdown) {
        dateDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarDropdown.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (!dateDropdownBtn.contains(e.target) && !calendarDropdown.contains(e.target)) {
                calendarDropdown.classList.add('hidden');
            }
        });
    }

    if (applyDateBtn && calendarInput) {
        applyDateBtn.addEventListener('click', () => {
            const selectedDate = calendarInput.value;
            if (selectedDate) {
                selectedDateLabel.textContent = selectedDate;
                calendarDropdown.classList.add('hidden');
                loadDashboardStats(selectedDate);
            }
        });
    }

    async function loadDashboardStats(targetDateStr = null) {
        if (!window.supabase) return;
        try {
            let targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
            let compareDate = new Date(targetDate);
            compareDate.setDate(targetDate.getDate() - 1);

            const formatDate = d => d.toISOString().split('T')[0];
            const targetStart = formatDate(targetDate) + "T00:00:00Z";
            const targetEnd = formatDate(targetDate) + "T23:59:59Z";
            const compareStart = formatDate(compareDate) + "T00:00:00Z";
            const compareEnd = formatDate(compareDate) + "T23:59:59Z";

            const getCount = async (table, statusCol, statusVal, dateCol, start, end) => {
                let query = supabase.from(table).select('id', { count: 'exact', head: true });
                if (statusCol && statusVal) query = query.eq(statusCol, statusVal);
                query = query.gte(dateCol, start).lte(dateCol, end);
                const { count } = await query;
                return count || 0;
            };

            const totalToday = await getCount('announcements', null, null, 'created_at', targetStart, targetEnd);
            const totalYest = await getCount('announcements', null, null, 'created_at', compareStart, compareEnd);
            const activeToday = await getCount('announcements', 'status', 'Ongoing', 'created_at', targetStart, targetEnd);
            const activeYest = await getCount('announcements', 'status', 'Ongoing', 'created_at', compareStart, compareEnd);
            const completedToday = await getCount('announcements', 'status', 'Completed', 'restored_at', targetStart, targetEnd);
            const completedYest = await getCount('announcements', 'status', 'Completed', 'restored_at', compareStart, compareEnd);

            const updateTile = (valId, trendId, iconId, current, previous) => {
                document.getElementById(valId).textContent = current;
                let percent = 0;
                if (previous > 0) percent = ((current - previous) / previous) * 100;
                else if (current > 0) percent = 100;
                
                let isGood = (valId === 'value-completed') ? percent >= 0 : percent <= 0;
                const iconEl = document.getElementById(iconId);
                const trendEl = document.getElementById(trendId);

                iconEl.textContent = percent > 0 ? 'arrow_upward' : percent < 0 ? 'arrow_downward' : 'remove';
                const colorClass = isGood ? "text-green-600" : "text-red-600";
                iconEl.className = `material-icons text-sm ${percent === 0 ? 'text-gray-500' : colorClass}`;
                
                trendEl.querySelector('span:last-child').textContent = (percent > 0 ? '+' : '') + Math.abs(percent).toFixed(1) + '%';
                trendEl.querySelector('span:last-child').className = `text-sm font-medium ${percent === 0 ? 'text-gray-500' : colorClass}`;
            };

            updateTile('value-total', 'trend-total', 'icon-total', totalToday, totalYest);
            updateTile('value-active', 'trend-active', 'icon-active', activeToday, activeYest);
            updateTile('value-completed', 'trend-completed', 'icon-completed', completedToday, completedYest);
        } catch (error) { console.error("Stats Error:", error); }
    }


    // ==============================
    // 3. ORIGINAL CHARTS (Feeders)
    // ==============================

    async function populateFeeders(listId) {
        const listContainer = document.getElementById(listId);
        if (!listContainer) return;
        
        listContainer.innerHTML = `<div class="p-2 text-sm text-gray-500">Loading...</div>`;

        const { data: feeders } = await supabase.from('feeders').select('id, name').order('name', { ascending: true });
        listContainer.innerHTML = "";

        if (feeders && feeders.length > 0) {
            feeders.forEach(feeder => {
                const label = document.createElement("label");
                label.className = "flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded";
                label.innerHTML = `<input type="checkbox" value="${feeder.id}" checked class="form-checkbox text-blue-600 feeder-checkbox"><span class="text-sm text-gray-700 dark:text-gray-200">${feeder.name}</span>`;
                listContainer.appendChild(label);
            });
        } else { listContainer.innerHTML = `<div class="p-2 text-sm">No feeders.</div>`; }
    }

    async function updateFeederChart() {
        if (!pieCanvas) return;
        const checked = Array.from(document.querySelectorAll("#feederList input:checked")).map(cb => cb.value);
        if (checked.length === 0) { if (feederChartInstance) feederChartInstance.destroy(); return; }

        const { data } = await supabase.from('announcements').select('feeder_id, feeders ( name )').in('feeder_id', checked);
        
        const counts = {};
        data?.forEach(item => {
            const name = item.feeders ? item.feeders.name : `Feeder ${item.feeder_id}`;
            counts[name] = (counts[name] || 0) + 1;
        });

        if (feederChartInstance) feederChartInstance.destroy();
        feederChartInstance = new Chart(pieCanvas, {
            type: 'pie',
            data: {
                labels: Object.keys(counts),
                datasets: [{ data: Object.values(counts), backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#6366F1', '#EC4899'] }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    }

    async function updateRestorationChart() {
        if (!barCanvas) return;
        const checked = Array.from(document.querySelectorAll("#restorationFeederList input:checked")).map(cb => cb.value);
        if (checked.length === 0) { if (restorationChartInstance) restorationChartInstance.destroy(); return; }

        const { data } = await supabase.from('announcements').select('created_at, restored_at, feeder_id, feeders ( name )')
            .eq('status', 'Completed').in('feeder_id', checked).not('restored_at', 'is', null);

        const accData = {}; 
        data?.forEach(item => {
            const name = item.feeders ? item.feeders.name : `ID ${item.feeder_id}`;
            const hrs = (new Date(item.restored_at) - new Date(item.created_at)) / 36e5;
            if (hrs > 0 && hrs < 1000) {
                if (!accData[name]) accData[name] = { total: 0, count: 0 };
                accData[name].total += hrs;
                accData[name].count++;
            }
        });

        const labels = Object.keys(accData);
        const values = labels.map(k => (accData[k].total / accData[k].count).toFixed(2));
        const isDark = document.documentElement.classList.contains('dark');

        if (restorationChartInstance) restorationChartInstance.destroy();
        restorationChartInstance = new Chart(barCanvas, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Avg Hours', data: values, backgroundColor: '#3B82F6' }] },
            options: {
                responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { color: isDark ? '#e5e7eb' : '#374151' }, grid: { color: isDark ? '#374151' : '#e5e7eb' } },
                    x: { ticks: { color: isDark ? '#e5e7eb' : '#374151' }, grid: { display: false } }
                }
            }
        });
    }

    // ==============================
    // 4. NEW ADVANCED ANALYTICS
    // ==============================
    async function loadAdvancedAnalytics() {
        const rootCtx = document.getElementById('rootCauseChart');
        const brgyCtx = document.getElementById('barangayImpactChart');
        const peakCtx = document.getElementById('peakTimeChart');
        const mttrCtx = document.getElementById('mttrTrendChart');

        if (!rootCtx || !brgyCtx || !peakCtx || !mttrCtx) return;
        const isDark = document.documentElement.classList.contains('dark');
        const textColor = isDark ? '#e5e7eb' : '#374151';

        // Fetch ALL needed data in one go to optimize
        const { data: allAnnouncements } = await supabase
            .from('announcements')
            .select('cause, areas_affected, created_at, restored_at, status')
            .order('created_at', { ascending: true });

        if (!allAnnouncements) return;

        // --- A. Root Cause (Pareto) ---
        const causeCounts = {};
        allAnnouncements.forEach(a => {
            const c = a.cause || 'Unknown';
            causeCounts[c] = (causeCounts[c] || 0) + 1;
        });
        
        const sortedCauses = Object.entries(causeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5
        
        if (rootCauseInstance) rootCauseInstance.destroy();
        rootCauseInstance = new Chart(rootCtx, {
            type: 'bar',
            data: {
                labels: sortedCauses.map(i => i[0]),
                datasets: [{ label: 'Incidents', data: sortedCauses.map(i => i[1]), backgroundColor: '#F59E0B', borderRadius: 4 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } }
        });

        // --- B. Most Affected Barangays ---
        const brgyCounts = {};
        allAnnouncements.forEach(a => {
            if (Array.isArray(a.areas_affected)) {
                a.areas_affected.forEach(b => {
                    brgyCounts[b] = (brgyCounts[b] || 0) + 1;
                });
            }
        });
        const sortedBrgys = Object.entries(brgyCounts).sort((a, b) => b[1] - a[1]).slice(0, 8); // Top 8

        if (barangayImpactInstance) barangayImpactInstance.destroy();
        barangayImpactInstance = new Chart(brgyCtx, {
            type: 'bar',
            data: {
                labels: sortedBrgys.map(i => i[0]),
                datasets: [{ label: 'Outage Events', data: sortedBrgys.map(i => i[1]), backgroundColor: '#EF4444', borderRadius: 4 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } }
        });

        // --- C. Peak Outage Times (Bubble Chart Simulation) ---
        // X = Hour (0-23), Y = Day (0-6), R = Count
        const timeMatrix = {};
        allAnnouncements.forEach(a => {
            const date = new Date(a.created_at);
            const key = `${date.getDay()}-${date.getHours()}`;
            timeMatrix[key] = (timeMatrix[key] || 0) + 1;
        });

        const bubbleData = Object.entries(timeMatrix).map(([key, count]) => {
            const [day, hour] = key.split('-').map(Number);
            return { x: hour, y: day, r: Math.min(count * 2, 20) }; // Scale radius
        });

        if (peakTimeInstance) peakTimeInstance.destroy();
        peakTimeInstance = new Chart(peakCtx, {
            type: 'bubble',
            data: { datasets: [{ label: 'Outage Frequency', data: bubbleData, backgroundColor: 'rgba(59, 130, 246, 0.6)' }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { min: 0, max: 24, title: { display: true, text: 'Hour of Day (24h)', color: textColor }, ticks: { color: textColor } },
                    y: { 
                        min: -1, max: 7, 
                        ticks: { callback: v => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][v], color: textColor } 
                    }
                },
                plugins: { legend: { display: false } }
            }
        });

        // --- D. MTTR Trend (Line Chart) ---
        const mttrByMonth = {};
        allAnnouncements.forEach(a => {
            if (a.restored_at && a.created_at) {
                const date = new Date(a.created_at);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                const hrs = (new Date(a.restored_at) - date) / 36e5;
                if (hrs > 0 && hrs < 1000) {
                    if (!mttrByMonth[monthKey]) mttrByMonth[monthKey] = { total: 0, count: 0 };
                    mttrByMonth[monthKey].total += hrs;
                    mttrByMonth[monthKey].count++;
                }
            }
        });

        const sortedMonths = Object.keys(mttrByMonth).sort();
        const mttrValues = sortedMonths.map(m => (mttrByMonth[m].total / mttrByMonth[m].count).toFixed(2));

        if (mttrTrendInstance) mttrTrendInstance.destroy();
        mttrTrendInstance = new Chart(mttrCtx, {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{ label: 'Avg Repair Time (Hrs)', data: mttrValues, borderColor: '#10B981', tension: 0.3, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } }
        });
    }

    // ==============================
    // 5. RECENT REPORTS & INIT
    // ==============================
    async function loadRecentReports() {
        if (!reportsTableBody) return;
        reportsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4">Loading...</td></tr>`;
        const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(6);
        reportsTableBody.innerHTML = "";

        if (data && data.length > 0) {
            data.forEach(item => {
                const row = document.createElement('tr');
                row.className = "hover:bg-gray-50 dark:hover:bg-gray-700/50";
                const title = item.cause || item.location || "Outage";
                const statusClass = getStatusClass(item.status);
                const dateStr = new Date(item.created_at).toLocaleDateString() + ' ' + new Date(item.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                row.innerHTML = `<td class="py-3 px-4 dark:text-gray-200">${item.id}</td><td class="py-3 px-4 dark:text-gray-300">${title}</td><td class="py-3 px-4 dark:text-gray-300">${item.feeder_id || '-'}</td><td class="py-3 px-4 dark:text-gray-300">${dateStr}</td><td class="py-3 px-4"><span class="px-2 py-1 rounded-full text-xs font-medium ${statusClass}">${item.status}</span></td><td class="py-3 px-4"><a href="outages.html" class="text-blue-600 hover:underline text-xs font-medium">View</a></td>`;
                reportsTableBody.appendChild(row);
            });
        } else { reportsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-gray-500">No recent announcements.</td></tr>`; }
    }

    function getStatusClass(status) {
        if(!status) return "bg-gray-100 text-gray-800";
        const s = status.toLowerCase();
        if(s === 'reported') return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
        if(s === 'ongoing') return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
        if(s === 'completed') return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }

    function setupFilter(btnId, popupId, selectAllId, clearId, applyId, listId, updateFn) {
        const btn = document.getElementById(btnId);
        const popup = document.getElementById(popupId);
        const selectAll = document.getElementById(selectAllId);
        const clear = document.getElementById(clearId);
        const apply = document.getElementById(applyId);
        const list = document.getElementById(listId);

        if(btn) btn.addEventListener('click', (e) => { e.stopPropagation(); popup.classList.toggle('hidden'); });
        document.addEventListener('click', (e) => { if(btn && popup && !btn.contains(e.target) && !popup.contains(e.target)) { popup.classList.add('hidden'); }});
        if(selectAll) selectAll.addEventListener('click', (e) => { e.stopPropagation(); list.querySelectorAll('input').forEach(i => i.checked = true); });
        if(clear) clear.addEventListener('click', (e) => { e.stopPropagation(); list.querySelectorAll('input').forEach(i => i.checked = false); });
        if(apply) apply.addEventListener('click', () => { popup.classList.add('hidden'); updateFn(); });
    }

    async function initDashboard() {
        setupFilter("feederFilterBtn", "feederFilterPopup", "feederSelectAll", "feederClear", "feederApply", "feederList", updateFeederChart);
        setupFilter("restorationFilterBtn", "restorationFilterPopup", "restorationSelectAll", "restorationClear", "restorationApply", "restorationFeederList", updateRestorationChart);

        loadDashboardStats(); 
        loadRecentReports();
        
        // Init Advanced Analytics
        loadAdvancedAnalytics();

        await Promise.all([populateFeeders("feederList"), populateFeeders("restorationFeederList")]);
        updateFeederChart();
        updateRestorationChart();
    }

    // ==============================
    // 6. PROFESSIONAL PDF REPORTING (COMPLETE & FIXED)
    // ==============================

    let currentPDFDoc = null; 

    // A. The "Brain": Generates recommendations for ALL charts
    function generateAnalysis(type, chartInstance) {
        if (!chartInstance || !chartInstance.data.datasets[0].data.length) return "Insufficient data for analysis.";
        
        const data = chartInstance.data.datasets[0].data;
        const labels = chartInstance.data.labels;

        // 1. Root Cause
        if (type === 'rootCause') {
            const maxVal = Math.max(...data);
            const topCause = labels[data.indexOf(maxVal)];
            if (topCause.includes('Vegetation')) return "Recommendation: Increase tree trimming schedule in high-risk corridors.";
            if (topCause.includes('Equipment')) return "Recommendation: Audit aging transformers and schedule preventive maintenance.";
            return `Recommendation: Investigate high frequency of '${topCause}' outages.`;
        }
        // 2. MTTR Trend (Efficiency)
        if (type === 'mttr') {
            const first = parseFloat(data[0]);
            const last = parseFloat(data[data.length - 1]);
            if (last < first) return "Analysis: Repair times are trending DOWN (Improving).\nRecommendation: Current maintenance strategies are effective.";
            if (last > first) return "Analysis: Repair times are trending UP (Slower).\nRecommendation: Investigate dispatch delays or staffing shortages.";
            return "Analysis: Repair times are stable.";
        }
        // 3. Feeder Impact (Pie)
        if (type === 'feederCount') {
            const maxVal = Math.max(...data);
            const name = labels[data.indexOf(maxVal)];
            return `Analysis: ${name} accounts for the highest volume of reports (${maxVal}).\nRecommendation: Prioritize infrastructure inspection on this line.`;
        }
        // 4. Restoration by Feeder (Bar)
        if (type === 'feederTime') {
            const maxVal = Math.max(...data);
            const name = labels[data.indexOf(maxVal)];
            return `Analysis: ${name} has the slowest recovery time (${maxVal} hrs avg).\nRecommendation: Check for access issues or equipment faults specific to this area.`;
        }
        // 5. Barangay Impact
        if (type === 'barangay') {
            const maxVal = Math.max(...data);
            const name = labels[data.indexOf(maxVal)];
            return `Analysis: ${name} is the most frequently affected community.\nRecommendation: Engage with community leaders in ${name} regarding upcoming improvements.`;
        }
        // 6. Peak Times
        if (type === 'peak') {
            // Bubble chart data structure is {x, y, r}
            const dataset = chartInstance.data.datasets[0].data;
            if(!dataset.length) return "No peak data.";
            // Find biggest bubble
            const maxBubble = dataset.reduce((prev, current) => (prev.r > current.r) ? prev : current);
            const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
            return `Analysis: Highest outage frequency observed on ${days[maxBubble.y]}s around ${maxBubble.x}:00 hours.\nRecommendation: Schedule additional standby crews during this window.`;
        }

        return "Data available in chart.";
    }

    // B. The Generator
    async function generatePDFObject() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        let yPos = 20;

        // --- 1. HEADER & SECURITY WARNING ---
        doc.setFontSize(24);
        doc.setTextColor(0, 123, 255); // Blue
        doc.setFont("helvetica", "bold");
        doc.text("BEACON SYSTEM REPORT", margin, yPos);
        
        yPos += 8;
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        
        // Get Admin Name from DOM
        const adminName = document.getElementById('adminName') ? document.getElementById('adminName').innerText : "Authorized Account";
        doc.text(`Generated by: ${adminName}  |  Date: ${new Date().toLocaleString()}`, margin, yPos);

        yPos += 10;
        // Warning Box
        doc.setFillColor(255, 240, 240); // Light Red
        doc.setDrawColor(200, 0, 0); // Dark Red Border
        doc.rect(margin, yPos - 5, pageWidth - (margin * 2), 12, 'FD');
        doc.setTextColor(200, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("WARNING: CONFIDENTIAL DATA. AUTHORIZED PERSONNEL ONLY.", pageWidth / 2, yPos + 2, { align: "center" });

        // --- 2. EXECUTIVE SUMMARY (TILES) ---
        yPos += 20;
        doc.setTextColor(0);
        doc.setFontSize(14);
        doc.text("1. Executive Summary (vs. Yesterday)", margin, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // Grab Data
        const tVal = document.getElementById('value-total')?.textContent || "0";
        const tTrend = document.getElementById('trendPercent-total')?.textContent || "0%";
        
        const aVal = document.getElementById('value-active')?.textContent || "0";
        const aTrend = document.getElementById('trendPercent-active')?.textContent || "0%";

        const cVal = document.getElementById('value-completed')?.textContent || "0";
        const cTrend = document.getElementById('trendPercent-completed')?.textContent || "0%";

        // Draw Summary Grid
        const boxWidth = (pageWidth - (margin * 2)) / 3;
        const boxH = 25;
        
        // Box 1
        doc.setFillColor(245, 247, 250); doc.rect(margin, yPos, boxWidth - 2, boxH, 'F');
        doc.setFont("helvetica", "bold"); doc.text("Total Reports", margin + 5, yPos + 8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(16); doc.text(tVal, margin + 5, yPos + 18);
        doc.setFontSize(10); doc.setTextColor(tTrend.includes('+') ? 200 : 0, tTrend.includes('+') ? 0 : 150, 0); // Red if +, Green if - (Context dependent)
        doc.text(tTrend, margin + 20, yPos + 18);

        // Box 2
        doc.setTextColor(0);
        doc.setFillColor(245, 247, 250); doc.rect(margin + boxWidth, yPos, boxWidth - 2, boxH, 'F');
        doc.setFont("helvetica", "bold"); doc.text("Active Outages", margin + boxWidth + 5, yPos + 8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(16); doc.text(aVal, margin + boxWidth + 5, yPos + 18);
        doc.setFontSize(10); doc.text(aTrend, margin + boxWidth + 20, yPos + 18);

        // Box 3
        doc.setTextColor(0);
        doc.setFillColor(245, 247, 250); doc.rect(margin + (boxWidth * 2), yPos, boxWidth - 2, boxH, 'F');
        doc.setFont("helvetica", "bold"); doc.text("Completed Repairs", margin + (boxWidth * 2) + 5, yPos + 8);
        doc.setFont("helvetica", "normal"); doc.setFontSize(16); doc.text(cVal, margin + (boxWidth * 2) + 5, yPos + 18);
        doc.setFontSize(10); doc.text(cTrend, margin + (boxWidth * 2) + 20, yPos + 18);

        yPos += 35;

        // --- 3. CHARTS LOOP ---
        const allCharts = [
            { title: "2. Outages by Feeder", instance: feederChartInstance, type: 'feederCount' },
            { title: "3. Avg Restoration Time by Feeder", instance: restorationChartInstance, type: 'feederTime' },
            { title: "4. Root Cause Analysis", instance: rootCauseInstance, type: 'rootCause' },
            { title: "5. Most Affected Barangays", instance: barangayImpactInstance, type: 'barangay' },
            { title: "6. Peak Outage Times", instance: peakTimeInstance, type: 'peak' },
            { title: "7. Monthly Efficiency Trend", instance: mttrTrendInstance, type: 'mttr' }
        ];

        doc.setTextColor(0);

        allCharts.forEach((item, index) => {
            if (item.instance) {
                // --- FIX: Calculate if the WHOLE chart fits ---
                // Height of: Title(6) + Image(80) + Box(20) + Spacing(24) = ~130
                const neededHeight = 130;
                
                if (yPos + neededHeight > pageHeight) { 
                    doc.addPage(); 
                    yPos = 20; 
                }

                // Title
                doc.setFontSize(12);
                doc.setFont("helvetica", "bold");
                doc.text(item.title, margin, yPos);
                yPos += 6;

                try {
                    // Chart
                    const canvasImg = item.instance.toBase64Image();
                    // Scale image to fit width
                    const imgWidth = 180;
                    const imgHeight = 80;
                    doc.addImage(canvasImg, 'PNG', margin, yPos, imgWidth, imgHeight);
                    yPos += imgHeight + 5;

                    // Recommendation Box
                    doc.setFillColor(240, 248, 255); // AliceBlue
                    doc.setDrawColor(200, 200, 200);
                    doc.rect(margin, yPos, pageWidth - (margin * 2), 20, 'DF');
                    
                    doc.setFont("helvetica", "normal");
                    doc.setFontSize(9);
                    doc.setTextColor(60);
                    
                    const analysisText = generateAnalysis(item.type, item.instance);
                    const splitText = doc.splitTextToSize(analysisText, pageWidth - (margin * 2) - 10);
                    doc.text(splitText, margin + 5, yPos + 7);
                    
                    doc.setTextColor(0);
                    yPos += 30; // Spacing for next chart
                } catch (e) { console.error("Chart error:", e); }
            }
        });

        // Footer
        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
            doc.text("BEACON Internal Document", margin, pageHeight - 10);
        }

        return doc;
    }

    // C. Preview & Download Handlers (Same as before)
    async function handlePreviewOpen() {
        const modal = document.getElementById('pdfPreviewModal');
        const iframe = document.getElementById('pdfPreviewFrame');
        const loading = document.getElementById('pdfLoading');
        
        if(!modal || !iframe) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        iframe.classList.add('hidden');
        loading.classList.remove('hidden');

        currentPDFDoc = await generatePDFObject();
        const pdfBlob = currentPDFDoc.output('bloburl');
        iframe.src = pdfBlob;

        loading.classList.add('hidden');
        iframe.classList.remove('hidden');
    }

    function handlePreviewClose() {
        const modal = document.getElementById('pdfPreviewModal');
        if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
        const iframe = document.getElementById('pdfPreviewFrame');
        if(iframe) iframe.src = "";
    }

    function handleDownload() {
        if (currentPDFDoc) {
            const dateStr = new Date().toISOString().split('T')[0];
            const adminName = document.getElementById('adminName') ? document.getElementById('adminName').innerText : "Admin";
            currentPDFDoc.save(`Beacon_Report_${adminName}_${dateStr}.pdf`);
            handlePreviewClose();
        }
    }

    // Listeners
    const triggerBtn = document.getElementById('downloadReportBtn');
    const closeBtn = document.getElementById('closePreviewBtn');
    const cancelBtn = document.getElementById('cancelPreviewBtn');
    const confirmBtn = document.getElementById('confirmDownloadBtn');

    if (triggerBtn) triggerBtn.addEventListener('click', handlePreviewOpen);
    if (closeBtn) closeBtn.addEventListener('click', handlePreviewClose);
    if (cancelBtn) cancelBtn.addEventListener('click', handlePreviewClose);
    if (confirmBtn) confirmBtn.addEventListener('click', handleDownload);

    initDashboard();
});