// Formula 1 Standings App Logic - GitHub Pages & Admin Auth Enabled

// F1 Points System Reference
const POINTS_MAP = {
    '1': 25,
    '2': 18,
    '3': 15,
    '4': 12,
    '5': 10,
    '6': 8,
    '7': 6,
    '8': 4,
    '9': 2,
    '10': 1
};

// Preset colors for initial drivers (simulating real F1 teams)
const DRIVER_COLORS = {
    'Retree': 'strip-retree',   // Mercedes teal
    'Руля': 'strip-rulya',       // Ferrari red
    'Лютый': 'strip-lyutyy',     // Red Bull blue
    'Вайлист': 'strip-vaylist',   // McLaren orange
    'Брикс': 'strip-briks',     // Aston Martin green
    'Козак': 'strip-kozak'       // Alpine blue
};

// Initial Seed Data (Excel Reference State)
const DEFAULT_STATE = {
    drivers: [
        { id: 'Retree', name: 'Retree' },
        { id: 'Руля', name: 'Руля' },
        { id: 'Лютый', name: 'Лютый' },
        { id: 'Вайлист', name: 'Вайлист' },
        { id: 'Брикс', name: 'Брикс' },
        { id: 'Козак', name: 'Козак' }
    ],
    races: ['Гонка 1', 'Гонка 2'],
    results: {
        'Гонка 1': {
            'Retree': '1',
            'Руля': '5',
            'Лютый': '2ПК',
            'Вайлист': '3',
            'Брикс': '4К',
            'Козак': 'DSQ'
        },
        'Гонка 2': {
            'Retree': '5',
            'Руля': '1',
            'Лютый': '4',
            'Вайлист': '3П',
            'Брикс': '2',
            'Козак': 'DNF'
        }
    }
};

// Default Admin Password SHA-256 Hash
// Default plain text password is: f1admin
// You can generate your own hash and replace it here.
const ADMIN_PASSWORD_HASH = "19b32eb6c57fd5dfcebaa150ebe11b82f2d8645ebb52a51c313533b458eda033";

// Application State
let state = {
    drivers: [],
    races: [],
    results: {}
};

// Temporary state for the active Results Entry Form
let activeFormResults = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    await initAuth();
    await loadState();
    initUI();
    renderAll();
});

// ==========================================================================
// Authentication System
// ==========================================================================

// Initialize Auth State from sessionStorage
async function initAuth() {
    const isLoggedIn = sessionStorage.getItem('f1_admin_logged_in') === 'true';
    setAdminMode(isLoggedIn);
}

// Set UI elements display based on login status
function setAdminMode(loggedIn) {
    if (loggedIn) {
        document.body.classList.add('admin-mode');
        document.getElementById('btn-auth-toggle').textContent = 'Выйти (Админ)';
        document.getElementById('btn-auth-toggle').classList.replace('btn-primary', 'btn-danger');
        sessionStorage.setItem('f1_admin_logged_in', 'true');
    } else {
        document.body.classList.remove('admin-mode');
        document.getElementById('btn-auth-toggle').textContent = 'Войти в админ-панель';
        document.getElementById('btn-auth-toggle').classList.replace('btn-danger', 'btn-primary');
        sessionStorage.setItem('f1_admin_logged_in', 'false');
    }
}

// Convert string to SHA-256 hex string
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Handle login attempt
async function attemptLogin() {
    const passwordInput = document.getElementById('admin-password');
    const errorMsg = document.getElementById('login-error');
    const password = passwordInput.value;
    
    const hashed = await sha256(password);
    if (hashed === ADMIN_PASSWORD_HASH) {
        setAdminMode(true);
        closeLoginModal();
        loadActiveFormResults();
        renderAll();
    } else {
        errorMsg.classList.add('active');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

function openLoginModal() {
    document.getElementById('login-modal').classList.add('active');
    document.getElementById('admin-password').value = '';
    document.getElementById('login-error').classList.remove('active');
    setTimeout(() => {
        document.getElementById('admin-password').focus();
    }, 100);
}

function closeLoginModal() {
    document.getElementById('login-modal').classList.remove('active');
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти из админ-панели?')) {
        setAdminMode(false);
        renderAll();
    }
}

// ==========================================================================
// Data Management & Storage
// ==========================================================================

// Load state: Fetches database.json from server, falling back to localStorage
async function loadState() {
    // Attempt to load official database.json (served statically on GitHub Pages)
    try {
        // Append unique timestamp query parameter to bypass browser caching
        const response = await fetch(`./database.json?t=${new Date().getTime()}`);
        if (response.ok) {
            const serverData = await response.json();
            if (serverData.drivers && serverData.races && serverData.results) {
                state = serverData;
                console.log('Standings loaded successfully from server (database.json).');
                return;
            }
        }
    } catch (e) {
        console.warn('Could not fetch database.json from server (this is normal when running locally without committing it first). Checking local storage...');
    }

    // Fallback: Local Storage
    const savedState = localStorage.getItem('f1_standings_state');
    if (savedState) {
        try {
            state = JSON.parse(savedState);
            if (!state.drivers || !state.races || !state.results) {
                throw new Error('Invalid state structure');
            }
        } catch (e) {
            console.error('Error loading saved state, reverting to default seed data:', e);
            state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        }
    } else {
        // Fallback: Excel Seed Data
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
}

// Save state to localStorage (local working copy)
function saveState() {
    localStorage.setItem('f1_standings_state', JSON.stringify(state));
}

// Reset state to initial Excel data
function resetToDefault() {
    if (confirm('Вы уверены, что хотите сбросить все локальные данные до состояния из Excel? Все неопубликованные изменения будут стёрты.')) {
        state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        saveState();
        
        // Reset selector
        const raceSelector = document.getElementById('post-race-select');
        if (raceSelector && state.races.length > 0) {
            raceSelector.value = state.races[0];
        }
        
        loadActiveFormResults();
        renderAll();
    }
}

// ==========================================================================
// Standing Calculations
// ==========================================================================

// Parse result string (e.g., "2ПК", "3П", "4К", "DSQ", "DNF", "1")
function parseResult(resultStr) {
    if (!resultStr) {
        return { position: '', pole: false, fastestLap: false, points: 0 };
    }

    const cleanStr = String(resultStr).trim().toUpperCase();
    
    // Check modifiers: Russian 'П'/'К', English 'P'/'K'
    const pole = cleanStr.includes('П') || cleanStr.includes('P');
    const fastestLap = cleanStr.includes('К') || cleanStr.includes('K');
    
    // Remove modifiers to get raw position
    let posStr = cleanStr.replace(/[ПКPK]/g, '');
    
    // Get points
    let points = 0;
    if (POINTS_MAP[posStr]) {
        points += POINTS_MAP[posStr];
    }
    
    if (pole) points += 1;
    if (fastestLap) points += 1;
    
    return {
        position: posStr,
        pole,
        fastestLap,
        points
    };
}

// Compile a result string from individual parts
function compileResultString(position, pole, fastestLap) {
    if (!position || position === 'NONE') return '';
    let res = position;
    if (pole) res += 'П';
    if (fastestLap) res += 'К';
    return res;
}

// Calculate standings leaderboard (with official F1 tiebreakers)
function calculateStandings() {
    const standings = state.drivers.map(driver => {
        let totalPoints = 0;
        const finishCounts = {};
        for (let i = 1; i <= 10; i++) finishCounts[i] = 0;
        
        state.races.forEach(race => {
            const raceResults = state.results[race] || {};
            const driverResult = raceResults[driver.id];
            if (driverResult) {
                const parsed = parseResult(driverResult);
                totalPoints += parsed.points;
                
                // Track positions for tiebreaking
                if (/^\d+$/.test(parsed.position)) {
                    const pos = parseInt(parsed.position, 10);
                    if (finishCounts[pos] !== undefined) {
                        finishCounts[pos]++;
                    }
                }
            }
        });
        
        return {
            ...driver,
            totalPoints,
            finishCounts
        };
    });
    
    // Sort Standings
    standings.sort((a, b) => {
        // 1. Total Points (descending)
        if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
        }
        
        // 2. Count of finishes (1st, then 2nd, then 3rd...)
        for (let i = 1; i <= 10; i++) {
            if (b.finishCounts[i] !== a.finishCounts[i]) {
                return b.finishCounts[i] - a.finishCounts[i];
            }
        }
        
        // 3. Alphabetical order
        return a.name.localeCompare(b.name);
    });
    
    return standings;
}

// ==========================================================================
// UI Rendering
// ==========================================================================

// Load results for the currently selected race into the activeFormResults temp state
function loadActiveFormResults() {
    const raceSelect = document.getElementById('post-race-select');
    const selectedRace = raceSelect.value;
    activeFormResults = {};
    
    if (selectedRace && state.results[selectedRace]) {
        state.drivers.forEach(driver => {
            const resultStr = state.results[selectedRace][driver.id] || '';
            const parsed = parseResult(resultStr);
            activeFormResults[driver.id] = {
                position: parsed.position || 'NONE',
                pole: parsed.pole,
                fastestLap: parsed.fastestLap
            };
        });
    } else {
        state.drivers.forEach(driver => {
            activeFormResults[driver.id] = {
                position: 'NONE',
                pole: false,
                fastestLap: false
            };
        });
    }
}

// Render everything
function renderAll() {
    renderLeaderboard();
    renderSelectors();
    renderResultsEntryForm();
}

// Render Leaderboard Standings Table
function renderLeaderboard() {
    const standings = calculateStandings();
    const tableHeaderRow = document.getElementById('leaderboard-headers');
    const tableBody = document.getElementById('leaderboard-body');
    
    // Clear headers
    tableHeaderRow.innerHTML = `
        <th class="pos-col">#</th>
        <th>Пилот</th>
    `;
    
    // Add columns for each race
    state.races.forEach(race => {
        const th = document.createElement('th');
        th.className = 'race-cell';
        th.textContent = race;
        tableHeaderRow.appendChild(th);
    });
    
    // Add Points Column header
    const ptsTh = document.createElement('th');
    ptsTh.className = 'points-col';
    ptsTh.textContent = 'Очки';
    tableHeaderRow.appendChild(ptsTh);
    
    // Clear body
    tableBody.innerHTML = '';
    
    if (standings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${state.races.length + 3}" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Нет зарегистрированных пилотов. Войдите в админ-панель, чтобы добавить участников.
                </td>
            </tr>
        `;
        return;
    }
    
    // Render rows
    standings.forEach((driver, index) => {
        const row = document.createElement('tr');
        row.className = 'leaderboard-row';
        
        // Rank
        const rank = index + 1;
        let rankClass = `pos-${rank}`;
        if (rank > 3) rankClass = '';
        
        const rankTd = document.createElement('td');
        rankTd.className = `pos-col ${rankClass}`;
        rankTd.textContent = rank;
        row.appendChild(rankTd);
        
        // Driver Name + Color Strip
        const driverTd = document.createElement('td');
        driverTd.className = 'driver-col';
        
        const stripColorClass = DRIVER_COLORS[driver.name] || 'strip-default';
        driverTd.innerHTML = `
            <div class="driver-cell-container">
                <div class="driver-strip ${stripColorClass}"></div>
                <span>${driver.name}</span>
            </div>
        `;
        row.appendChild(driverTd);
        
        // Race Results Cells
        state.races.forEach(race => {
            const td = document.createElement('td');
            td.className = 'race-cell';
            
            const raceResults = state.results[race] || {};
            const resultStr = raceResults[driver.id] || '';
            
            if (resultStr) {
                const parsed = parseResult(resultStr);
                let badgeClass = 'badge-pts';
                let textToShow = parsed.position;
                
                if (parsed.position === '1') badgeClass = 'badge-p1';
                else if (parsed.position === '2') badgeClass = 'badge-p2';
                else if (parsed.position === '3') badgeClass = 'badge-p3';
                else if (parsed.position === 'DSQ') { badgeClass = 'badge-dsq'; textToShow = 'DSQ'; }
                else if (parsed.position === 'DNF') { badgeClass = 'badge-dnf'; textToShow = 'DNF'; }
                else if (parsed.position === 'DNS') { badgeClass = 'badge-dns'; textToShow = 'DNS'; }
                
                let modifiersHtml = '';
                if (parsed.pole) modifiersHtml += `<span class="mod-indicator mod-p" title="Поул-позиция">П</span>`;
                if (parsed.fastestLap) modifiersHtml += `<span class="mod-indicator mod-k" title="Быстрый круг">К</span>`;
                
                td.innerHTML = `
                    <span class="badge ${badgeClass}">${textToShow}</span>${modifiersHtml}
                `;
            } else {
                td.innerHTML = `<span style="color: var(--border-color);">-</span>`;
            }
            
            row.appendChild(td);
        });
        
        // Total Points
        const ptsTd = document.createElement('td');
        ptsTd.className = 'points-col';
        ptsTd.textContent = driver.totalPoints;
        row.appendChild(ptsTd);
        
        tableBody.appendChild(row);
    });
}

// Render dropdown selectors in UI panels
function renderSelectors() {
    const raceSelect = document.getElementById('post-race-select');
    const deleteRaceSelect = document.getElementById('delete-race-select');
    const deleteDriverSelect = document.getElementById('delete-driver-select');
    
    const currentSelectedRace = raceSelect.value;
    
    // 1. Race post selector
    raceSelect.innerHTML = '';
    state.races.forEach(race => {
        const opt = document.createElement('option');
        opt.value = race;
        opt.textContent = race;
        raceSelect.appendChild(opt);
    });
    
    // Restore selection or select first
    if (state.races.includes(currentSelectedRace)) {
        raceSelect.value = currentSelectedRace;
    } else if (state.races.length > 0) {
        raceSelect.value = state.races[0];
    }
    
    // Initialize active form results for selected race if empty
    if (Object.keys(activeFormResults).length === 0 && state.races.length > 0) {
        loadActiveFormResults();
    }
    
    // 2. Race delete selector
    deleteRaceSelect.innerHTML = '<option value="" disabled selected>Выберите гонку...</option>';
    state.races.forEach(race => {
        const opt = document.createElement('option');
        opt.value = race;
        opt.textContent = race;
        deleteRaceSelect.appendChild(opt);
    });
    
    // 3. Driver delete selector
    deleteDriverSelect.innerHTML = '<option value="" disabled selected>Выберите пилота...</option>';
    state.drivers.forEach(driver => {
        const opt = document.createElement('option');
        opt.value = driver.id;
        opt.textContent = driver.name;
        deleteDriverSelect.appendChild(opt);
    });
}

// Render Results Entry Form list based on current activeFormResults
function renderResultsEntryForm() {
    const container = document.getElementById('results-entry-container');
    container.innerHTML = '';
    
    const raceSelect = document.getElementById('post-race-select');
    const selectedRace = raceSelect.value;
    
    if (!selectedRace) {
        container.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">
                Создайте гонку, чтобы вносить результаты.
            </div>
        `;
        document.getElementById('btn-post-results').disabled = true;
        return;
    }
    
    document.getElementById('btn-post-results').disabled = false;
    
    state.drivers.forEach(driver => {
        if (!activeFormResults[driver.id]) {
            activeFormResults[driver.id] = { position: 'NONE', pole: false, fastestLap: false };
        }
        
        const entry = activeFormResults[driver.id];
        const card = document.createElement('div');
        card.className = 'driver-entry-card';
        
        // Driver Strip color
        const stripColorClass = DRIVER_COLORS[driver.name] || 'strip-default';
        
        // Build position dropdown options
        let posOptionsHtml = `
            <option value="NONE" ${entry.position === 'NONE' ? 'selected' : ''}>Нет результата</option>
            <option value="DNF" ${entry.position === 'DNF' ? 'selected' : ''}>DNF (Сход)</option>
            <option value="DNS" ${entry.position === 'DNS' ? 'selected' : ''}>DNS (Не стартовал)</option>
            <option value="DSQ" ${entry.position === 'DSQ' ? 'selected' : ''}>DSQ (Дискв.)</option>
        `;
        for (let i = 1; i <= 10; i++) {
            posOptionsHtml += `<option value="${i}" ${entry.position == String(i) ? 'selected' : ''}>${i} место</option>`;
        }
        
        card.innerHTML = `
            <div class="entry-name">
                <div class="driver-strip ${stripColorClass}"></div>
                <span>${driver.name}</span>
            </div>
            <div class="entry-pos-select">
                <div class="select-wrapper">
                    <select data-driver-id="${driver.id}">
                        ${posOptionsHtml}
                    </select>
                </div>
            </div>
            <div class="entry-modifiers">
                <button type="button" class="toggle-btn ${entry.pole ? 'active' : ''}" data-driver-id="${driver.id}" data-mod="P" title="Поул-позиция (П)">П</button>
                <button type="button" class="toggle-btn ${entry.fastestLap ? 'active' : ''}" data-driver-id="${driver.id}" data-mod="K" title="Быстрый круг (К)">К</button>
            </div>
        `;
        
        // Attach listeners for position selector
        const select = card.querySelector('select');
        select.addEventListener('change', (e) => {
            activeFormResults[driver.id].position = e.target.value;
        });
        
        // Attach listeners for toggle buttons (P and K)
        const toggleButtons = card.querySelectorAll('.toggle-btn');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mod = btn.getAttribute('data-mod');
                if (mod === 'P') {
                    activeFormResults[driver.id].pole = !activeFormResults[driver.id].pole;
                    btn.classList.toggle('active', activeFormResults[driver.id].pole);
                } else if (mod === 'K') {
                    activeFormResults[driver.id].fastestLap = !activeFormResults[driver.id].fastestLap;
                    btn.classList.toggle('active', activeFormResults[driver.id].fastestLap);
                }
            });
        });
        
        container.appendChild(card);
    });
}

// ==========================================================================
// Admin UI Listeners & Handlers
// ==========================================================================

function initUI() {
    // 1. Auth bindings
    document.getElementById('btn-auth-toggle').addEventListener('click', () => {
        const loggedIn = sessionStorage.getItem('f1_admin_logged_in') === 'true';
        if (loggedIn) {
            logout();
        } else {
            openLoginModal();
        }
    });

    document.getElementById('btn-login-cancel').addEventListener('click', closeLoginModal);
    document.getElementById('btn-login-submit').addEventListener('click', attemptLogin);
    document.getElementById('admin-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });

    // Close modal when clicking overlay (outside the card)
    document.getElementById('login-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('login-modal')) {
            closeLoginModal();
        }
    });

    // 2. Race Results Form bindings
    const raceSelect = document.getElementById('post-race-select');
    raceSelect.addEventListener('change', () => {
        loadActiveFormResults();
        renderResultsEntryForm();
    });

    document.getElementById('btn-post-results').addEventListener('click', postResults);

    // 3. Admin Panel controls (Add/Delete Drivers/Races)
    document.getElementById('btn-add-driver').addEventListener('click', addDriver);
    document.getElementById('new-driver-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDriver();
    });

    document.getElementById('btn-delete-driver').addEventListener('click', deleteDriver);

    document.getElementById('btn-add-race').addEventListener('click', addRace);
    document.getElementById('new-race-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addRace();
    });

    document.getElementById('btn-delete-race').addEventListener('click', deleteRace);

    // 4. Manual backups
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import-trigger').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);

    // Reset settings
    document.getElementById('btn-reset').addEventListener('click', resetToDefault);

    // 5. GitHub API credentials preloading & publishing
    loadGitHubCredentials();
    document.getElementById('btn-publish-github').addEventListener('click', publishToGitHub);
}

// Action: Post Results
function postResults() {
    const raceSelect = document.getElementById('post-race-select');
    const selectedRace = raceSelect.value;
    
    if (!selectedRace) return;
    
    // Validation: Check duplicate finishing positions (1-10)
    const positionCounts = {};
    let hasDuplicate = false;
    let duplicatePos = '';
    
    Object.keys(activeFormResults).forEach(driverId => {
        const pos = activeFormResults[driverId].position;
        if (pos !== 'NONE' && pos !== 'DNF' && pos !== 'DNS' && pos !== 'DSQ') {
            positionCounts[pos] = (positionCounts[pos] || 0) + 1;
            if (positionCounts[pos] > 1) {
                hasDuplicate = true;
                duplicatePos = pos;
            }
        }
    });
    
    if (hasDuplicate) {
        if (!confirm(`Предупреждение: Место ${duplicatePos} назначено нескольким пилотам. Вы хотите продолжить сохранение?`)) {
            return;
        }
    }
    
    if (!state.results[selectedRace]) {
        state.results[selectedRace] = {};
    }
    
    state.drivers.forEach(driver => {
        const formRes = activeFormResults[driver.id];
        if (formRes && formRes.position !== 'NONE') {
            state.results[selectedRace][driver.id] = compileResultString(
                formRes.position,
                formRes.pole,
                formRes.fastestLap
            );
        } else {
            delete state.results[selectedRace][driver.id];
        }
    });
    
    saveState();
    renderLeaderboard();
    
    // Success Button Animation
    const btn = document.getElementById('btn-post-results');
    const originalText = btn.textContent;
    btn.textContent = 'Успешно сохранено локально! ✓';
    btn.style.backgroundColor = 'var(--success)';
    btn.style.borderColor = 'var(--success)';
    btn.style.color = '#000000';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
        btn.style.borderColor = '';
        btn.style.color = '';
    }, 2000);
}

// Action: Add Driver
function addDriver() {
    const nameInput = document.getElementById('new-driver-name');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Имя пилота не может быть пустым.');
        return;
    }
    
    const exists = state.drivers.some(d => d.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('Пилот с таким именем уже существует.');
        return;
    }
    
    const driverId = name;
    state.drivers.push({ id: driverId, name: name });
    
    if (!DRIVER_COLORS[name]) {
        const colors = ['strip-retree', 'strip-rulya', 'strip-lyutyy', 'strip-vaylist', 'strip-briks', 'strip-kozak'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        DRIVER_COLORS[name] = randomColor;
    }
    
    saveState();
    loadActiveFormResults();
    renderAll();
    
    nameInput.value = '';
}

// Action: Delete Driver
function deleteDriver() {
    const select = document.getElementById('delete-driver-select');
    const driverId = select.value;
    
    if (!driverId) {
        alert('Пожалуйста, выберите пилота для удаления.');
        return;
    }
    
    const driverName = state.drivers.find(d => d.id === driverId)?.name || driverId;
    if (confirm(`Вы уверены, что хотите удалить пилота "${driverName}"? Все его результаты будут стёрты.`)) {
        state.drivers = state.drivers.filter(d => d.id !== driverId);
        state.races.forEach(race => {
            if (state.results[race] && state.results[race][driverId]) {
                delete state.results[race][driverId];
            }
        });
        
        saveState();
        loadActiveFormResults();
        renderAll();
    }
}

// Action: Add Race
function addRace() {
    const nameInput = document.getElementById('new-race-name');
    const raceName = nameInput.value.trim();
    
    if (!raceName) {
        alert('Название гонки не может быть пустым.');
        return;
    }
    
    const exists = state.races.some(r => r.toLowerCase() === raceName.toLowerCase());
    if (exists) {
        alert('Гонка с таким названием уже существует.');
        return;
    }
    
    state.races.push(raceName);
    state.results[raceName] = {};
    saveState();
    
    const raceSelect = document.getElementById('post-race-select');
    renderSelectors();
    raceSelect.value = raceName;
    
    loadActiveFormResults();
    renderAll();
    
    nameInput.value = '';
}

// Action: Delete Race
function deleteRace() {
    const select = document.getElementById('delete-race-select');
    const raceName = select.value;
    
    if (!raceName) {
        alert('Пожалуйста, выберите гонку для удаления.');
        return;
    }
    
    if (confirm(`Вы уверены, что хотите удалить гонку "${raceName}"? Все результаты этой гонки будут безвозвратно удалены.`)) {
        state.races = state.races.filter(r => r !== raceName);
        delete state.results[raceName];
        saveState();
        
        const raceSelect = document.getElementById('post-race-select');
        if (raceSelect.value === raceName) {
            raceSelect.value = state.races.length > 0 ? state.races[0] : '';
        }
        
        loadActiveFormResults();
        renderAll();
    }
}

// Action: Export Data
function exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `database.json`); // Download as database.json directly
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

// Action: Import Data
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedState = JSON.parse(e.target.result);
            if (importedState.drivers && importedState.races && importedState.results) {
                if (confirm('Вы уверены, что хотите импортировать файл? Это перезапишет текущую базу результатов.')) {
                    state = importedState;
                    saveState();
                    
                    const raceSelect = document.getElementById('post-race-select');
                    if (state.races.length > 0) {
                        raceSelect.value = state.races[0];
                    }
                    
                    loadActiveFormResults();
                    renderAll();
                    alert('Данные успешно импортированы в локальное хранилище!');
                }
            } else {
                alert('Ошибка: Файл имеет некорректную структуру F1 Standings.');
            }
        } catch (err) {
            alert('Ошибка при чтении JSON-файла: ' + err.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ==========================================================================
// GitHub API Auto-Publishing Integration
// ==========================================================================

// Preload saved GitHub credentials from localStorage
function loadGitHubCredentials() {
    document.getElementById('github-user').value = localStorage.getItem('f1_gh_user') || '';
    document.getElementById('github-repo').value = localStorage.getItem('f1_gh_repo') || '';
    document.getElementById('github-branch').value = localStorage.getItem('f1_gh_branch') || 'main';
    document.getElementById('github-token').value = localStorage.getItem('f1_gh_token') || '';
}

// Save active GitHub credentials to localStorage
function saveGitHubCredentials() {
    const user = document.getElementById('github-user').value.trim();
    const repo = document.getElementById('github-repo').value.trim();
    const branch = document.getElementById('github-branch').value.trim();
    const token = document.getElementById('github-token').value.trim();

    localStorage.setItem('f1_gh_user', user);
    localStorage.setItem('f1_gh_repo', repo);
    localStorage.setItem('f1_gh_branch', branch);
    localStorage.setItem('f1_gh_token', token);
}

// Publish updated state directly to GitHub repository database.json via REST API
async function publishToGitHub() {
    const user = document.getElementById('github-user').value.trim();
    const repo = document.getElementById('github-repo').value.trim();
    const branch = document.getElementById('github-branch').value.trim();
    const token = document.getElementById('github-token').value.trim();
    const statusDiv = document.getElementById('publish-status');

    // Validation
    if (!user || !repo || !branch || !token) {
        showPublishStatus('Пожалуйста, заполните все поля для публикации на GitHub (Пользователь, Репозиторий, Ветка и Токен).', 'error');
        return;
    }

    // Save inputs locally
    saveGitHubCredentials();

    showPublishStatus('<div class="status-spinner"></div> Подготовка к публикации на GitHub...', 'pending');

    try {
        const filePath = 'database.json';
        const fileUrl = `https://api.github.com/repos/${user}/${repo}/contents/${filePath}`;
        
        let sha = null;
        
        // Step 1: Check if the file already exists to get its SHA (required by GitHub API for updates)
        const getFileResponse = await fetch(`${fileUrl}?ref=${branch}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (getFileResponse.ok) {
            const fileData = await getFileResponse.json();
            sha = fileData.sha;
        } else if (getFileResponse.status !== 404) {
            throw new Error(`Ошибка проверки файла на GitHub (Код: ${getFileResponse.status})`);
        }

        // Step 2: Encode the state data into UTF-8 Base64
        const contentStr = JSON.stringify(state, null, 2);
        
        // Use TextEncoder to handle Cyrillic/UTF-8 strings properly during base64 conversion
        const encodedContent = btoa(
            new TextEncoder().encode(contentStr).reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // Step 3: Put/Update file on GitHub
        const commitMessage = `Standings update: ${new Date().toLocaleString('ru-RU')}`;
        const requestBody = {
            message: commitMessage,
            content: encodedContent,
            branch: branch
        };

        if (sha) {
            requestBody.sha = sha; // include sha to update file
        }

        const putResponse = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(requestBody)
        });

        if (putResponse.ok || putResponse.status === 201) {
            showPublishStatus('🎉 Изменения успешно отправлены на GitHub! Обновление на сайте займет около 1–2 минут.', 'success');
        } else {
            const errData = await putResponse.json();
            throw new Error(errData.message || `Ошибка HTTP: ${putResponse.status}`);
        }

    } catch (error) {
        console.error('GitHub API error:', error);
        showPublishStatus(`❌ Ошибка публикации: ${error.message}. Проверьте правильность введенных токена, имени пользователя и репозитория.`, 'error');
    }
}

// Display publishing status messages
function showPublishStatus(htmlMessage, type) {
    const statusDiv = document.getElementById('publish-status');
    statusDiv.innerHTML = htmlMessage;
    statusDiv.style.display = 'block';
    
    // Clear classes
    statusDiv.className = 'status-msg';
    
    if (type === 'success') statusDiv.classList.add('status-success');
    if (type === 'error') statusDiv.classList.add('status-error');
    if (type === 'pending') statusDiv.classList.add('status-pending');
}
