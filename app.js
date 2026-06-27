// Result Logger - F1 League Standings App Logic (Firebase Synced)

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
const PRESET_DRIVER_COLORS = {
    'Retree': '#00d2be',   // Mercedes teal
    'Руля': '#e10600',       // Ferrari red
    'Лютый': '#1634ff',     // Red Bull blue
    'Вайлист': '#ff9000',   // McLaren orange
    'Брикс': '#005a30',     // Aston Martin green
    'Козак': '#4b92ff'       // Alpine blue
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
    races: [
        { id: 'Гонка 1', name: 'Гонка 1', emoji: '🏁' },
        { id: 'Гонка 2', name: 'Гонка 2', emoji: '🏁' }
    ],
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
const ADMIN_PASSWORD_HASH = "19b32eb6c57fd5dfcebaa150ebe11b82f2d8645ebb52a51c313533b458eda033";

// Firebase Realtime Database Endpoint (Public Read/Write)
const FIREBASE_DB_URL = "https://f1lc-afbbc-default-rtdb.asia-southeast1.firebasedatabase.app/";

// Application State
let currentViewMode = 'individual';
let state = {
    drivers: [],
    races: [],
    results: {}
};

// Database references
let database = null;
let isFirebaseConnected = false;
let isFirebaseInitialized = false;

// Temporary state for the active Results Entry Form
let activeFormResults = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
    initAuth();
    initUI();
    initFirebase();
});

// ==========================================================================
// Firebase Integration
// ==========================================================================

function initFirebase() {
    const banner = document.getElementById('db-status-banner');
    const text = document.getElementById('db-status-text');
    const dbUrlText = document.getElementById('firebase-db-url-text');
    
    dbUrlText.textContent = FIREBASE_DB_URL;
    
    try {
        if (typeof firebase !== 'undefined') {
            // Initialize Firebase App with only the databaseURL
            firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
            database = firebase.database();
            isFirebaseInitialized = true;
            
            // Monitor connection status
            const connectedRef = database.ref(".info/connected");
            connectedRef.on("value", (snap) => {
                if (snap.val() === true) {
                    isFirebaseConnected = true;
                    updateConnectionUI(true);
                } else {
                    isFirebaseConnected = false;
                    // If it was already working and then disconnected, show connecting
                    updateConnectionUI(false);
                }
            });
            
            // Subscribe to database path '/f1_standings' for real-time updates
            database.ref('/f1_standings').on('value', (snapshot) => {
                const dbData = snapshot.val();
                if (dbData) {
                    state = ensureSchema(dbData);
                    console.log('Real-time database sync: state loaded from Firebase.');
                } else {
                    // Seed Firebase if it is completely empty
                    console.log('Firebase node is empty. Initializing with default seed data...');
                    state = ensureSchema(JSON.parse(JSON.stringify(DEFAULT_STATE)));
                    database.ref('/f1_standings').set(state);
                }
                renderAll();
            }, (error) => {
                console.error("Firebase read cancelled/failed:", error);
                isFirebaseConnected = false;
                updateConnectionUI(false, error.message);
            });
            
        } else {
            throw new Error("Firebase SDK script files not loaded.");
        }
    } catch (e) {
        console.error("Firebase initialization failed, falling back to local mode:", e);
        isFirebaseInitialized = false;
        updateConnectionUI(false, e.message);
        loadLocalFallback();
    }
}

// Update connection state elements in UI with error messages
function updateConnectionUI(online, errorMessage = '') {
    const banner = document.getElementById('db-status-banner');
    const text = document.getElementById('db-status-text');
    const badge = document.getElementById('firebase-connection-status-badge');
    
    if (online) {
        banner.className = 'db-status-banner banner-online';
        badge.textContent = 'В СЕТИ';
        badge.className = 'badge badge-pts';
        badge.style.backgroundColor = 'var(--success)';
        badge.style.color = '#000000';
    } else {
        if (!isFirebaseInitialized) {
            banner.className = 'db-status-banner banner-offline';
            text.textContent = `Сбой SDK: Firebase не подключен. Работа в автономном режиме. (${errorMessage || 'Неизвестная ошибка'})`;
            badge.textContent = 'ОШИБКА SDK';
            badge.className = 'badge badge-dsq';
        } else {
            if (errorMessage) {
                banner.className = 'db-status-banner banner-offline';
                text.textContent = `Ошибка Firebase: ${errorMessage}. Проверьте правила доступа или AdBlock/Brave Shields.`;
                badge.textContent = 'ОШИБКА БД';
                badge.className = 'badge badge-dsq';
            } else {
                banner.className = 'db-status-banner banner-connecting';
                text.textContent = 'Соединение потеряно. Попытка переподключения... (Данные кэшируются локально)';
                badge.textContent = 'АВТОНОМНО';
                badge.className = 'badge badge-dnf';
            }
        }
    }
}

// Global browser error logger for debugging CORS / AdBlockers
window.addEventListener('error', (event) => {
    const banner = document.getElementById('db-status-banner');
    const text = document.getElementById('db-status-text');
    if (banner && text && event.message && 
       (event.message.toLowerCase().includes('firebase') || 
        event.message.toLowerCase().includes('cors') || 
        event.message.toLowerCase().includes('blocked') || 
        event.message.toLowerCase().includes('database'))) {
        banner.className = 'db-status-banner banner-offline';
        text.textContent = `Браузер заблокировал запрос: ${event.message}. (Отключите AdBlock / Brave Shields для этого сайта)`;
    }
});


// Fallback to localStorage if Firebase script fails to load
function loadLocalFallback() {
    const savedState = localStorage.getItem('f1_standings_state');
    if (savedState) {
        try {
            state = ensureSchema(JSON.parse(savedState));
        } catch (e) {
            console.error('Error loading fallback local state, reverting to seed:', e);
            state = ensureSchema(JSON.parse(JSON.stringify(DEFAULT_STATE)));
        }
    } else {
        state = ensureSchema(JSON.parse(JSON.stringify(DEFAULT_STATE)));
    }
    renderAll();
}

// Convert schema if loaded database uses strings for races (backward compatibility)
function ensureSchema(dataObj) {
    if (!dataObj) return DEFAULT_STATE;
    
    const cleanData = { ...dataObj };
    if (!cleanData.drivers) cleanData.drivers = [];
    if (!cleanData.races) cleanData.races = [];
    if (!cleanData.results) cleanData.results = {};
    
    // Adapt races array elements to object structures if they are strings
    cleanData.races = cleanData.races.map(race => {
        if (typeof race === 'string') {
            return { id: race, name: race, emoji: '🏁' };
        }
        return {
            id: race.id || 'race_unknown',
            name: race.name || race.id || 'Unknown',
            emoji: race.emoji || '🏁'
        };
    });
    
    // Adapt drivers to ensure they have color, team, and teamTag
    cleanData.drivers = cleanData.drivers.map(driver => {
        const id = driver.id || driver.name || 'unknown';
        const name = driver.name || driver.id || 'Unknown';
        
        let color = driver.color;
        if (!color) {
            color = PRESET_DRIVER_COLORS[name] || '#94a3b8';
        }
        
        return {
            id: id,
            name: name,
            number: driver.number || '',
            color: color,
            team: driver.team || '',
            teamTag: driver.teamTag || ''
        };
    });
    
    return cleanData;
}

// Save state: Pushes to Firebase if initialized, and always saves a local backup
function saveState() {
    // Save backup to Local Storage
    localStorage.setItem('f1_standings_state', JSON.stringify(state));
    
    // Push to Firebase Realtime Database (which handles offline cache automatically)
    if (isFirebaseInitialized && database) {
        database.ref('/f1_standings').set(state)
            .then(() => {
                console.log('Firebase synced successfully.');
            })
            .catch(e => {
                console.error('Firebase sync error (changes will sync when online):', e);
            });
    }
}

// Reset data in the database
function resetToDefault() {
    if (confirm('Вы уверены, что хотите сбросить ВСЮ базу данных в Firebase до исходного состояния из Excel? Это изменит таблицу для всех пользователей.')) {
        state = ensureSchema(JSON.parse(JSON.stringify(DEFAULT_STATE)));
        saveState();
        
        const raceSelector = document.getElementById('post-race-select');
        if (raceSelector && state.races.length > 0) {
            raceSelector.value = state.races[0].id;
        }
        
        loadActiveFormResults();
        renderAll();
    }
}

// ==========================================================================
// Authentication System
// ==========================================================================

function initAuth() {
    const isLoggedIn = sessionStorage.getItem('f1_admin_logged_in') === 'true';
    setAdminMode(isLoggedIn);
}

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

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
// Standing Calculations
// ==========================================================================

function parseResult(resultStr) {
    if (!resultStr) {
        return { position: '', pole: false, fastestLap: false, points: 0 };
    }

    const cleanStr = String(resultStr).trim().toUpperCase();
    const pole = cleanStr.includes('П') || cleanStr.includes('P');
    const fastestLap = cleanStr.includes('К') || cleanStr.includes('K');
    let posStr = cleanStr.replace(/[ПКPK]/g, '');
    
    let points = 0;
    if (POINTS_MAP[posStr]) {
        points += POINTS_MAP[posStr];
    }
    
    if (pole) points += 1;
    if (fastestLap) points += 1;
    
    return { position: posStr, pole, fastestLap, points };
}

function compileResultString(position, pole, fastestLap) {
    if (!position || position === 'NONE') return '';
    let res = position;
    if (pole) res += 'П';
    if (fastestLap) res += 'К';
    return res;
}

function calculateStandings() {
    const standings = state.drivers.map(driver => {
        let totalPoints = 0;
        const finishCounts = {};
        for (let i = 1; i <= 10; i++) finishCounts[i] = 0;
        
        state.races.forEach(race => {
            const raceResults = state.results[race.id] || {};
            const driverResult = raceResults[driver.id];
            if (driverResult) {
                const parsed = parseResult(driverResult);
                totalPoints += parsed.points;
                
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
    
    standings.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
        }
        for (let i = 1; i <= 10; i++) {
            if (b.finishCounts[i] !== a.finishCounts[i]) {
                return b.finishCounts[i] - a.finishCounts[i];
            }
        }
        return a.name.localeCompare(b.name);
    });
    
    return standings;
}

function calculateConstructorsStandings() {
    const teams = {};
    
    // 1. Group drivers by team
    state.drivers.forEach(driver => {
        if (!driver.team) return; // Skip drivers without a team
        
        const teamName = driver.team.trim();
        if (!teamName) return;
        
        if (!teams[teamName]) {
            teams[teamName] = {
                id: teamName,
                name: teamName,
                tag: driver.teamTag || '',
                color: driver.color || '#94a3b8',
                drivers: [],
                totalPoints: 0,
                finishCounts: {},
                racePoints: {}
            };
            for (let i = 1; i <= 10; i++) teams[teamName].finishCounts[i] = 0;
        }
        
        teams[teamName].drivers.push(driver.id);
    });
    
    // 2. Calculate points per team
    const teamList = Object.values(teams);
    
    teamList.forEach(team => {
        state.races.forEach(race => {
            const raceResults = state.results[race.id] || {};
            let raceTeamPoints = 0;
            
            team.drivers.forEach(driverId => {
                const driverResult = raceResults[driverId];
                if (driverResult) {
                    const parsed = parseResult(driverResult);
                    raceTeamPoints += parsed.points;
                    
                    if (/^\d+$/.test(parsed.position)) {
                        const pos = parseInt(parsed.position, 10);
                        if (team.finishCounts[pos] !== undefined) {
                            team.finishCounts[pos]++;
                        }
                    }
                }
            });
            
            team.racePoints[race.id] = raceTeamPoints;
            team.totalPoints += raceTeamPoints;
        });
    });
    
    // 3. Sort teams
    teamList.sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) {
            return b.totalPoints - a.totalPoints;
        }
        for (let i = 1; i <= 10; i++) {
            if (b.finishCounts[i] !== a.finishCounts[i]) {
                return b.finishCounts[i] - a.finishCounts[i];
            }
        }
        return a.name.localeCompare(b.name);
    });
    
    return teamList;
}

// ==========================================================================
// UI Rendering
// ==========================================================================

function loadActiveFormResults() {
    const raceSelect = document.getElementById('post-race-select');
    const selectedRaceId = raceSelect.value;
    activeFormResults = {};
    
    if (selectedRaceId && state.results[selectedRaceId]) {
        state.drivers.forEach(driver => {
            const resultStr = state.results[selectedRaceId][driver.id] || '';
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

function renderAll() {
    renderLeaderboard();
    renderSelectors();
    renderResultsEntryForm();
}

function renderLeaderboard() {
    const isConstructors = currentViewMode === 'constructors';
    const standings = isConstructors ? calculateConstructorsStandings() : calculateStandings();
    
    const tableHeaderRow = document.getElementById('leaderboard-headers');
    const tableBody = document.getElementById('leaderboard-body');
    
    tableHeaderRow.innerHTML = `
        <th class="pos-col">#</th>
        <th>${isConstructors ? 'Команда' : 'Пилот'}</th>
    `;
    
    // Add columns for each race displaying the emoji flag and name
    state.races.forEach(race => {
        const th = document.createElement('th');
        th.className = 'race-cell';
        th.innerHTML = `
            <div class="race-header-content">
                <span class="race-header-emoji">${race.emoji || '🏁'}</span>
                <span class="race-header-name">${race.name || race.id}</span>
            </div>
        `;
        th.setAttribute('title', race.name || race.id); // Tooltip on hover
        tableHeaderRow.appendChild(th);
    });
    
    const ptsTh = document.createElement('th');
    ptsTh.className = 'points-col';
    ptsTh.textContent = 'Очки';
    tableHeaderRow.appendChild(ptsTh);
    
    tableBody.innerHTML = '';
    
    if (standings.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${state.races.length + 3}" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    Нет зарегистрированных пилотов. Войдите в админ-панель, чтобы внести участников.
                </td>
            </tr>
        `;
        return;
    }
    
    standings.forEach((entity, index) => {
        const row = document.createElement('tr');
        row.className = 'leaderboard-row';
        
        const rank = index + 1;
        let rankClass = `pos-${rank}`;
        if (rank > 3) rankClass = '';
        
        const rankTd = document.createElement('td');
        rankTd.className = `pos-col ${rankClass}`;
        rankTd.textContent = rank;
        row.appendChild(rankTd);
        
        const entityTd = document.createElement('td');
        entityTd.className = 'driver-col';
        
        const stripColor = entity.color || '#94a3b8';
        let badgeHtml = '';
        if (isConstructors) {
            badgeHtml = entity.tag ? `<span class="team-tag-badge" style="--team-color: ${stripColor}">${entity.tag}</span>` : '';
        } else {
            badgeHtml = entity.teamTag ? `<span class="team-tag-badge" style="--team-color: ${stripColor}" title="${entity.team || ''}">${entity.teamTag}</span>` : '';
        }
        
        let numberHtml = '';
        if (!isConstructors && entity.number) {
            numberHtml = `<span style="margin-right: 0.2rem;">${entity.number}</span>`;
        }
        
        entityTd.innerHTML = `
            <div class="driver-cell-container">
                <div class="driver-strip" style="background-color: ${stripColor}"></div>
                ${numberHtml}
                <span>${entity.name}</span>
                ${badgeHtml}
            </div>
        `;
        row.appendChild(entityTd);
        
        state.races.forEach(race => {
            const td = document.createElement('td');
            td.className = 'race-cell';
            
            if (isConstructors) {
                const pts = entity.racePoints[race.id];
                if (pts !== undefined && pts > 0) {
                    td.innerHTML = `<span class="badge badge-pts">${pts}</span>`;
                } else {
                    td.innerHTML = `<span style="color: var(--border-color);">-</span>`;
                }
            } else {
                const raceResults = state.results[race.id] || {};
                const resultStr = raceResults[entity.id] || '';
                
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
            }
            
            row.appendChild(td);
        });
        
        const ptsTd = document.createElement('td');
        ptsTd.className = 'points-col';
        ptsTd.textContent = entity.totalPoints;
        row.appendChild(ptsTd);
        
        tableBody.appendChild(row);
    });
}

function renderSelectors() {
    const raceSelect = document.getElementById('post-race-select');
    const deleteRaceSelect = document.getElementById('delete-race-select');
    const deleteDriverSelect = document.getElementById('delete-driver-select');
    const editDriverSelect = document.getElementById('edit-driver-select');
    
    const currentSelectedRaceId = raceSelect.value;
    const currentEditDriverId = editDriverSelect ? editDriverSelect.value : '';
    
    // 1. Race post selector
    raceSelect.innerHTML = '';
    state.races.forEach(race => {
        const opt = document.createElement('option');
        opt.value = race.id;
        opt.textContent = `${race.emoji || '🏁'} ${race.name}`;
        raceSelect.appendChild(opt);
    });
    
    // Restore selection or select first
    const hasActiveSelection = state.races.some(r => r.id === currentSelectedRaceId);
    if (hasActiveSelection) {
        raceSelect.value = currentSelectedRaceId;
    } else if (state.races.length > 0) {
        raceSelect.value = state.races[0].id;
    }
    
    if (Object.keys(activeFormResults).length === 0 && state.races.length > 0) {
        loadActiveFormResults();
    }
    
    // 2. Race delete selector
    deleteRaceSelect.innerHTML = '<option value="" disabled selected>Выберите гонку...</option>';
    state.races.forEach(race => {
        const opt = document.createElement('option');
        opt.value = race.id;
        opt.textContent = `${race.emoji || '🏁'} ${race.name}`;
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

    // 4. Driver edit selector
    if (editDriverSelect) {
        editDriverSelect.innerHTML = '<option value="" disabled selected>Выберите пилота для редактирования...</option>';
        state.drivers.forEach(driver => {
            const opt = document.createElement('option');
            opt.value = driver.id;
            opt.textContent = driver.name;
            editDriverSelect.appendChild(opt);
        });
        if (state.drivers.some(d => d.id === currentEditDriverId)) {
            editDriverSelect.value = currentEditDriverId;
        }
    }
}

function renderResultsEntryForm() {
    const container = document.getElementById('results-entry-container');
    container.innerHTML = '';
    
    const raceSelect = document.getElementById('post-race-select');
    const selectedRaceId = raceSelect.value;
    
    if (!selectedRaceId) {
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
        
        const stripColor = driver.color || '#94a3b8';
        
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
                <div class="driver-strip" style="background-color: ${stripColor}"></div>
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
        
        const select = card.querySelector('select');
        select.addEventListener('change', (e) => {
            activeFormResults[driver.id].position = e.target.value;
        });
        
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
    // 0. Championship Toggle
    const btnIndividual = document.getElementById('btn-champ-individual');
    const btnConstructors = document.getElementById('btn-champ-constructors');
    const leaderboardHeading = document.getElementById('leaderboard-heading');
    
    if (btnIndividual && btnConstructors) {
        btnIndividual.addEventListener('click', () => {
            currentViewMode = 'individual';
            btnIndividual.classList.add('active');
            btnConstructors.classList.remove('active');
            leaderboardHeading.textContent = 'Таблица Личного Зачета';
            renderLeaderboard();
        });
        
        btnConstructors.addEventListener('click', () => {
            currentViewMode = 'constructors';
            btnConstructors.classList.add('active');
            btnIndividual.classList.remove('active');
            leaderboardHeading.textContent = 'Кубок Конструкторов';
            renderLeaderboard();
        });
    }

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

    // 3. Admin Panel controls (Add/Delete/Edit Drivers/Races)
    document.getElementById('btn-add-driver').addEventListener('click', addDriver);
    document.getElementById('new-driver-name').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addDriver();
    });

    document.getElementById('btn-delete-driver').addEventListener('click', deleteDriver);

    // Edit Driver listeners
    const editSelect = document.getElementById('edit-driver-select');
    const editFields = document.getElementById('edit-driver-fields');
    if (editSelect && editFields) {
        editSelect.addEventListener('change', () => {
            const driverId = editSelect.value;
            const driver = state.drivers.find(d => d.id === driverId);
            
            if (driver) {
                const editNumInput = document.getElementById('edit-driver-number');
                if (editNumInput) editNumInput.value = driver.number || '';
                document.getElementById('edit-driver-name').value = driver.name;
                document.getElementById('edit-driver-team').value = driver.team || '';
                document.getElementById('edit-driver-tag').value = driver.teamTag || '';
                document.getElementById('edit-driver-color').value = driver.color || '#94a3b8';
                editFields.style.display = 'block';
            } else {
                editFields.style.display = 'none';
            }
        });
    }

    const btnEditSave = document.getElementById('btn-edit-driver-save');
    if (btnEditSave) {
        btnEditSave.addEventListener('click', saveDriverEdit);
    }

    document.getElementById('btn-add-race').addEventListener('click', addRace);

    document.getElementById('btn-delete-race').addEventListener('click', deleteRace);

    // 4. Backups
    document.getElementById('btn-export').addEventListener('click', exportData);
    document.getElementById('btn-import-trigger').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);

    // Reset settings
    document.getElementById('btn-reset').addEventListener('click', resetToDefault);
}

// Action: Post Results
function postResults() {
    const raceSelect = document.getElementById('post-race-select');
    const selectedRaceId = raceSelect.value;
    
    if (!selectedRaceId) return;
    
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
    
    if (!state.results[selectedRaceId]) {
        state.results[selectedRaceId] = {};
    }
    
    state.drivers.forEach(driver => {
        const formRes = activeFormResults[driver.id];
        if (formRes && formRes.position !== 'NONE') {
            state.results[selectedRaceId][driver.id] = compileResultString(
                formRes.position,
                formRes.pole,
                formRes.fastestLap
            );
        } else {
            delete state.results[selectedRaceId][driver.id];
        }
    });
    
    saveState();
    
    // Success Button Animation
    const btn = document.getElementById('btn-post-results');
    const originalText = btn.textContent;
    btn.textContent = 'Успешно сохранено в Firebase! ✓';
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
    const numberInput = document.getElementById('new-driver-number');
    const teamInput = document.getElementById('new-driver-team');
    const tagInput = document.getElementById('new-driver-tag');
    const colorInput = document.getElementById('new-driver-color');
    
    const name = nameInput.value.trim();
    const number = numberInput ? numberInput.value.trim() : '';
    const team = teamInput.value.trim();
    const teamTag = tagInput.value.trim().toUpperCase();
    const color = colorInput.value;
    
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
    state.drivers.push({
        id: driverId,
        name: name,
        number: number,
        team: team,
        teamTag: teamTag,
        color: color
    });
    
    saveState();
    loadActiveFormResults();
    renderAll();
    
    nameInput.value = '';
    if (numberInput) numberInput.value = '';
    teamInput.value = '';
    tagInput.value = '';
    // Color picker stays at current value
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
            if (state.results[race.id] && state.results[race.id][driverId]) {
                delete state.results[race.id][driverId];
            }
        });
        
        saveState();
        loadActiveFormResults();
        renderAll();
    }
}

// Action: Save Driver Edit
function saveDriverEdit() {
    const select = document.getElementById('edit-driver-select');
    const oldId = select.value;
    
    if (!oldId) {
        alert('Пожалуйста, выберите пилота для редактирования.');
        return;
    }
    
    const nameInput = document.getElementById('edit-driver-name');
    const numberInput = document.getElementById('edit-driver-number');
    const teamInput = document.getElementById('edit-driver-team');
    const tagInput = document.getElementById('edit-driver-tag');
    const colorInput = document.getElementById('edit-driver-color');
    
    const newName = nameInput.value.trim();
    const number = numberInput ? numberInput.value.trim() : '';
    const team = teamInput.value.trim();
    const teamTag = tagInput.value.trim().toUpperCase();
    const color = colorInput.value;
    
    if (!newName) {
        alert('Имя пилота не может быть пустым.');
        return;
    }
    
    // Verify name uniqueness (except when keeping the same name)
    if (newName.toLowerCase() !== oldId.toLowerCase()) {
        const exists = state.drivers.some(d => d.name.toLowerCase() === newName.toLowerCase());
        if (exists) {
            alert('Пилот с таким именем уже существует.');
            return;
        }
    }
    
    // 1. Update the driver details inside state
    const driverIndex = state.drivers.findIndex(d => d.id === oldId);
    if (driverIndex === -1) return;
    
    // Replace/update the driver object
    state.drivers[driverIndex] = {
        id: newName,
        name: newName,
        number: number,
        team: team,
        teamTag: teamTag,
        color: color
    };
    
    // 2. Migrate results key if name/ID changed!
    if (newName !== oldId) {
        state.races.forEach(race => {
            if (state.results[race.id] && state.results[race.id][oldId] !== undefined) {
                state.results[race.id][newName] = state.results[race.id][oldId];
                delete state.results[race.id][oldId];
            }
        });
        
        // Update DRIVER_COLORS preset dynamically if they want, but color is inside object now.
        // We'll update the active form results key if needed, or simply let loadActiveFormResults() handle it
    }
    
    saveState();
    
    // Reset and collapse form
    document.getElementById('edit-driver-fields').style.display = 'none';
    select.value = '';
    
    loadActiveFormResults();
    renderAll();
    
    alert('Данные пилота успешно сохранены!');
}

// Action: Add Race (with Name + Emoji Flag)
function addRace() {
    const nameInput = document.getElementById('new-race-name');
    const emojiInput = document.getElementById('new-race-emoji');
    
    const name = nameInput.value.trim();
    let emoji = emojiInput.value.trim();
    
    if (!name) {
        alert('Название гонки не может быть пустым.');
        return;
    }
    
    if (!emoji) {
        emoji = '🏁';
    }
    
    // Generate a unique ID for the race (race_ + timestamp)
    const raceId = 'race_' + new Date().getTime();
    
    const exists = state.races.some(r => r.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        alert('Гонка с таким названием уже существует.');
        return;
    }
    
    state.races.push({ id: raceId, name: name, emoji: emoji });
    state.results[raceId] = {};
    
    saveState();
    
    const raceSelect = document.getElementById('post-race-select');
    renderSelectors();
    raceSelect.value = raceId;
    
    loadActiveFormResults();
    renderAll();
    
    nameInput.value = '';
    emojiInput.value = '';
}

// Action: Delete Race
function deleteRace() {
    const select = document.getElementById('delete-race-select');
    const raceId = select.value;
    
    if (!raceId) {
        alert('Пожалуйста, выберите гонку для удаления.');
        return;
    }
    
    const raceObject = state.races.find(r => r.id === raceId);
    const displayName = raceObject ? `${raceObject.emoji} ${raceObject.name}` : raceId;
    
    if (confirm(`Вы уверены, что хотите удалить гонку "${displayName}"? Все её результаты будут безвозвратно стёрты.`)) {
        state.races = state.races.filter(r => r.id !== raceId);
        delete state.results[raceId];
        
        saveState();
        
        const raceSelect = document.getElementById('post-race-select');
        if (raceSelect.value === raceId) {
            raceSelect.value = state.races.length > 0 ? state.races[0].id : '';
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
    downloadAnchor.setAttribute("download", `database.json`);
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
            const verifiedState = ensureSchema(importedState);
            if (verifiedState.drivers && verifiedState.races && verifiedState.results) {
                if (confirm('Вы уверены, что хотите импортировать файл? Это перезапишет текущую базу результатов в Firebase.')) {
                    state = verifiedState;
                    saveState();
                    
                    const raceSelect = document.getElementById('post-race-select');
                    if (state.races.length > 0) {
                        raceSelect.value = state.races[0].id;
                    }
                    
                    loadActiveFormResults();
                    renderAll();
                    alert('Данные успешно импортированы и сохранены в Firebase!');
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
