// ==========================
// SETTINGS PAGE SCRIPT 
// ==========================

document.addEventListener("DOMContentLoaded", () => {
    console.log("Settings Page Script (v1) Loaded.");

    // --- Theme (Dark Mode) Logic ---
    const themeLightBtn = document.getElementById('theme-light');
    const themeDarkBtn = document.getElementById('theme-dark');
    const themeSystemBtn = document.getElementById('theme-system');
    const htmlElement = document.documentElement;

    // Sets the active button style
    function updateThemeButtons(theme) {
        const buttons = [themeLightBtn, themeDarkBtn, themeSystemBtn];
        buttons.forEach(btn => {
            btn.classList.remove('bg-white', 'dark:bg-gray-900', 'text-blue-600', 'dark:text-blue-300', 'shadow');
            btn.classList.add('text-gray-500', 'dark:text-gray-400');
        });

        let activeBtn;
        if (theme === 'light') activeBtn = themeLightBtn;
        else if (theme === 'dark') activeBtn = themeDarkBtn;
        else activeBtn = themeSystemBtn;
        
        if (activeBtn) {
            activeBtn.classList.add('bg-white', 'dark:bg-gray-900', 'text-blue-600', 'dark:text-blue-300', 'shadow');
            activeBtn.classList.remove('text-gray-500', 'dark:text-gray-400');
        }
    }

    // Applies the theme to the HTML tag
    function applyTheme(theme) {
        if (theme === 'light') {
            htmlElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else if (theme === 'dark') {
            htmlElement.classList.add('dark');
            localStorage.theme = 'dark';
        } else { // System
            localStorage.removeItem('theme');
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                htmlElement.classList.add('dark');
            } else {
                htmlElement.classList.remove('dark');
            }
        }
        updateThemeButtons(theme);
    }

    // Add click listeners
    themeLightBtn?.addEventListener('click', () => applyTheme('light'));
    themeDarkBtn?.addEventListener('click', () => applyTheme('dark'));
    themeSystemBtn?.addEventListener('click', () => applyTheme('system'));

    // Set initial button state on load
    const currentTheme = localStorage.theme || 'system';
    updateThemeButtons(currentTheme);
    
    // Listen for system changes (if 'system' is selected)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        if (!('theme' in localStorage)) { // Only if system is selected
            applyTheme('system');
        }
    });


    // --- Profile Modal Trigger ---
    const openProfileModalBtnSettings = document.getElementById('openProfileModalBtnSettings');
    const openProfileModalBtnShared = document.getElementById('openProfileModalBtn');
    openProfileModalBtnSettings?.addEventListener('click', (e) => {
        e.preventDefault();
        // Triggers the function in shared.js
        if (openProfileModalBtnShared) openProfileModalBtnShared.click();
    });


    // --- Admin Auth Modal Logic ---
    const adminAuthModal = document.getElementById('adminAuthModal');
    const adminAuthForm = document.getElementById('adminAuthForm');
    const closeAuthModalBtn = document.getElementById('closeAuthModalBtn');
    const cancelAuthBtn = document.getElementById('cancelAuthBtn');
    const confirmAuthBtn = document.getElementById('confirmAuthBtn');
    const adminAuthPassword = document.getElementById('adminAuthPassword');
    const authError = document.getElementById('authError');

    let onAuthSuccessCallback = null; // Stores the function to run after password is confirmed

    function openAdminAuth(onSuccess) {
        onAuthSuccessCallback = onSuccess; // Set what to do next
        authError.textContent = '';
        adminAuthPassword.value = '';
        adminAuthModal?.classList.remove('hidden');
        adminAuthModal?.classList.add('flex');
        adminAuthPassword.focus();
    }

    function closeAdminAuth() {
        adminAuthModal?.classList.add('hidden');
        adminAuthModal?.classList.remove('flex');
        onAuthSuccessCallback = null;
    }
    
    closeAuthModalBtn?.addEventListener('click', closeAdminAuth);
    cancelAuthBtn?.addEventListener('click', closeAdminAuth);

    // Handle password confirmation
    adminAuthForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!window.supabase) {
            authError.textContent = "Supabase client not loaded.";
            return;
        }

        const password = adminAuthPassword.value;
        if (!password) {
            authError.textContent = "Password is required.";
            return;
        }
        
        authError.textContent = '';
        confirmAuthBtn.disabled = true;
        confirmAuthBtn.textContent = 'Verifying...';

        // Get the current user's email to verify password
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            authError.textContent = "Not logged in. Please log in again.";
            confirmAuthBtn.disabled = false;
            confirmAuthBtn.textContent = 'Confirm';
            return;
        }

        // Verify the password by trying to sign in with it
        const { error } = await supabase.auth.signInWithPassword({
            email: user.email,
            password: password,
        });

        if (error) {
            authError.textContent = "Incorrect password. Please try again.";
        } else {
            // SUCCESS
            closeAdminAuth();
            if (typeof onAuthSuccessCallback === 'function') {
                onAuthSuccessCallback(); // Run the stored function (e.g., openFeederModal)
            }
        }
        
        confirmAuthBtn.disabled = false;
        confirmAuthBtn.textContent = 'Confirm';
    });


    // --- Configuration Modal Triggers ---
    document.getElementById('manageFeedersBtn')?.addEventListener('click', () => {
        openAdminAuth(openFeederModal); // Ask for password *then* open modal
    });
    
    document.getElementById('manageTeamsBtn')?.addEventListener('click', () => {
        openAdminAuth(openTeamModal); // Ask for password *then* open modal
    });


    // ===================================
    // FEEDER MANAGEMENT (CRUD)
    // ===================================
    const feederModal = document.getElementById('feederModal');
    const closeFeederModalBtn = document.getElementById('closeFeederModalBtn');
    const feederForm = document.getElementById('feederForm');
    const feederFormTitle = document.getElementById('feederFormTitle');
    const feederListContainer = document.getElementById('feederListContainer');
    const feederEditId = document.getElementById('feederEditId');
    const feederName = document.getElementById('feederName');
    const feederCode = document.getElementById('feederCode');
    const cancelFeederEditBtn = document.getElementById('cancelFeederEditBtn');
    const saveFeederBtn = document.getElementById('saveFeederBtn');

    function openFeederModal() {
        feederModal?.classList.remove('hidden');
        feederModal?.classList.add('flex');
        resetFeederForm();
        loadFeeders();
    }
    
    function closeFeederModal() {
        feederModal?.classList.add('hidden');
        feederModal?.classList.remove('flex');
    }
    
    function resetFeederForm() {
        feederForm.reset();
        feederEditId.value = '';
        feederFormTitle.textContent = 'Add New Feeder';
        saveFeederBtn.textContent = 'Save Feeder';
        cancelFeederEditBtn.classList.add('hidden');
    }

    closeFeederModalBtn?.addEventListener('click', closeFeederModal);
    cancelFeederEditBtn?.addEventListener('click', resetFeederForm);

    async function loadFeeders() {
        if (!window.supabase) return;
        feederListContainer.innerHTML = '<p class="text-sm text-gray-500 p-4 text-center">Loading feeders...</p>';
        
        // --- ASSUMPTION: Table is named 'feeders' ---
        // --- with columns: 'id', 'name', 'code' ---
        const { data: feeders, error } = await supabase
            .from('feeders')
            .select('*')
            .order('id', { ascending: true });

        if (error) {
            feederListContainer.innerHTML = `<p class="text-sm text-red-500 p-4 text-center">Error: ${error.message}</p>`;
            return;
        }

        if (feeders.length === 0) {
            feederListContainer.innerHTML = '<p class="text-sm text-gray-500 p-4 text-center">No feeders found. Add one above.</p>';
            return;
        }

        feederListContainer.innerHTML = '';
        feeders.forEach(feeder => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border dark:border-gray-700';
            div.innerHTML = `
                <div>
                  <span class="font-medium text-gray-900 dark:text-white">${feeder.name}</span>
                  <span class="text-sm text-gray-500 dark:text-gray-400 ml-2">(${feeder.code || 'N/A'})</span>
                </div>
                <div class="space-x-2">
                  <button class="edit-feeder-btn p-1 text-blue-600 hover:text-blue-800" data-id="${feeder.id}" data-name="${feeder.name}" data-code="${feeder.code || ''}">
                    <span class="material-icons text-base">edit</span>
                  </button>
                  <button class="delete-feeder-btn p-1 text-red-600 hover:text-red-800" data-id="${feeder.id}">
                    <span class="material-icons text-base">delete</span>
                  </button>
                </div>
            `;
            feederListContainer.appendChild(div);
        });

        // Add event listeners for new buttons
        feederListContainer.querySelectorAll('.edit-feeder-btn').forEach(btn => {
            btn.addEventListener('click', () => handleEditFeeder(btn.dataset));
        });
        feederListContainer.querySelectorAll('.delete-feeder-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteFeeder(btn.dataset.id));
        });
    }

    function handleEditFeeder(dataset) {
        feederEditId.value = dataset.id;
        feederName.value = dataset.name;
        feederCode.value = dataset.code;
        feederFormTitle.textContent = 'Edit Feeder';
        saveFeederBtn.textContent = 'Update Feeder';
        cancelFeederEditBtn.classList.remove('hidden');
        feederName.focus();
    }

    async function handleDeleteFeeder(id) {
        if (!window.confirm("Are you sure you want to delete this feeder? This action cannot be undone.")) {
            return;
        }
        
        const { error } = await supabase.from('feeders').delete().eq('id', id);
        if (error) {
            alert(`Error deleting feeder: ${error.message}`);
        } else {
            window.showSuccessPopup("Feeder deleted.");
            loadFeeders();
        }
    }

    feederForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = feederEditId.value;
        const newName = feederName.value;
        const newCode = feederCode.value;

        let query;
        if (id) {
            // Update
            query = supabase.from('feeders').update({ name: newName, code: newCode }).eq('id', id);
        } else {
            // Insert
            query = supabase.from('feeders').insert([{ name: newName, code: newCode }]);
        }

        const { error } = await query;
        if (error) {
            alert(`Error saving feeder: ${error.message}`);
        } else {
            window.showSuccessPopup(id ? "Feeder updated." : "Feeder added.");
            resetFeederForm();
            loadFeeders();
        }
    });

    // ===================================
    // DISPATCH TEAM MANAGEMENT (CRUD)
    // ===================================
    // This follows the exact same pattern as Feeders
    
    const teamModal = document.getElementById('teamModal');
    const closeTeamModalBtn = document.getElementById('closeTeamModalBtn');
    const teamForm = document.getElementById('teamForm');
    const teamFormTitle = document.getElementById('teamFormTitle');
    const teamListContainer = document.getElementById('teamListContainer');
    const teamEditId = document.getElementById('teamEditId');
    const teamName = document.getElementById('teamName');
    const cancelTeamEditBtn = document.getElementById('cancelTeamEditBtn');
    const saveTeamBtn = document.getElementById('saveTeamBtn');

    function openTeamModal() {
        teamModal?.classList.remove('hidden');
        teamModal?.classList.add('flex');
        resetTeamForm();
        loadTeams();
    }
    
    function closeTeamModal() {
        teamModal?.classList.add('hidden');
        teamModal?.classList.remove('flex');
    }
    
    function resetTeamForm() {
        teamForm.reset();
        teamEditId.value = '';
        teamFormTitle.textContent = 'Add New Team';
        saveTeamBtn.textContent = 'Save Team';
        cancelTeamEditBtn.classList.add('hidden');
    }

    closeTeamModalBtn?.addEventListener('click', closeTeamModal);
    cancelTeamEditBtn?.addEventListener('click', resetTeamForm);

    async function loadTeams() {
        if (!window.supabase) return;
        teamListContainer.innerHTML = '<p class="text-sm text-gray-500 p-4 text-center">Loading teams...</p>';
        
        // --- ASSUMPTION: Table is named 'dispatch_teams' ---
        // --- with columns: 'id', 'name' ---
        const { data: teams, error } = await supabase
            .from('dispatch_teams')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            teamListContainer.innerHTML = `<p class="text-sm text-red-500 p-4 text-center">Error: ${error.message}</p>`;
            return;
        }

        if (teams.length === 0) {
            teamListContainer.innerHTML = '<p class="text-sm text-gray-500 p-4 text-center">No teams found. Add one above.</p>';
            return;
        }

        teamListContainer.innerHTML = '';
        teams.forEach(team => {
            const div = document.createElement('div');
            div.className = 'flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded-md shadow-sm border dark:border-gray-700';
            div.innerHTML = `
                <span class="font-medium text-gray-900 dark:text-white">${team.name}</span>
                <div class="space-x-2">
                  <button class="edit-team-btn p-1 text-blue-600 hover:text-blue-800" data-id="${team.id}" data-name="${team.name}">
                    <span class="material-icons text-base">edit</span>
                  </button>
                  <button class="delete-team-btn p-1 text-red-600 hover:text-red-800" data-id="${team.id}">
                    <span class="material-icons text-base">delete</span>
                  </button>
                </div>
            `;
            teamListContainer.appendChild(div);
        });

        teamListContainer.querySelectorAll('.edit-team-btn').forEach(btn => {
            btn.addEventListener('click', () => handleEditTeam(btn.dataset));
        });
        teamListContainer.querySelectorAll('.delete-team-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteTeam(btn.dataset.id));
        });
    }

    function handleEditTeam(dataset) {
        teamEditId.value = dataset.id;
        teamName.value = dataset.name;
        teamFormTitle.textContent = 'Edit Team';
        saveTeamBtn.textContent = 'Update Team';
        cancelTeamEditBtn.classList.remove('hidden');
        teamName.focus();
    }

    async function handleDeleteTeam(id) {
        if (!window.confirm("Are you sure you want to delete this team?")) {
            return;
        }
        
        const { error } = await supabase.from('dispatch_teams').delete().eq('id', id);
        if (error) {
            alert(`Error deleting team: ${error.message}`);
        } else {
            window.showSuccessPopup("Team deleted.");
            loadTeams();
        }
    }

    teamForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = teamEditId.value;
        const newName = teamName.value;

        let query;
        if (id) {
            query = supabase.from('dispatch_teams').update({ name: newName }).eq('id', id);
        } else {
            query = supabase.from('dispatch_teams').insert([{ name: newName }]);
        }

        const { error } = await query;
        if (error) {
            alert(`Error saving team: ${error.message}`);
        } else {
            window.showSuccessPopup(id ? "Team updated." : "Team added.");
            resetTeamForm();
            loadTeams();
        }
    });

});