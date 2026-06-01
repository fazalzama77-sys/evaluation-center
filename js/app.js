(() => {
  // --- STATE VARIABLES ---
  let appConfig = {
    targetCredits: 20,
    frames: []
  };
  let evaluations = [];
  let activeDate = new Date().toISOString().slice(0, 10);
  let activeEntry = createEmptyEntry(activeDate);
  let isServerOnline = true;
  let deferredInstallPrompt = null;
  
  // Chart instances
  let trendChartInstance = null;
  let splitChartInstance = null;

  // LocalStorage keys
  const LS_CONFIG_KEY = 'auraTrack_config';
  const LS_EVALS_KEY = 'auraTrack_evaluations';
  const LS_DRAFT_KEY = 'auraTrack_draft';

  // --- DOM ELEMENTS ---
  const el = {
    syncStatus: document.getElementById('syncStatus'),
    installAppBtn: document.getElementById('installAppBtn'),
    themeToggle: document.getElementById('themeToggle'),
    settingsBtn: document.getElementById('settingsBtn'),
    settingsModal: document.getElementById('settingsModal'),
    closeSettings: document.getElementById('closeSettings'),
    saveSettingsBtn: document.getElementById('saveSettingsBtn'),
    settingsTargetCredits: document.getElementById('settingsTargetCredits'),
    categoryConfigurator: document.getElementById('categoryConfigurator'),
    clearAllBtn: document.getElementById('clearAllBtn'),
    clearClientCacheBtn: document.getElementById('clearClientCacheBtn'),

    importBtn: document.getElementById('importBtn'),
    importModal: document.getElementById('importModal'),
    closeImport: document.getElementById('closeImport'),
    importFile: document.getElementById('importFile'),
    submitImportBtn: document.getElementById('submitImportBtn'),
    
    evalDate: document.getElementById('evalDate'),
    categoriesContainer: document.getElementById('categoriesContainer'),
    journalNotes: document.getElementById('journalNotes'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    
    // Self-Mirror & Micro KPIs
    mirrorCard: document.getElementById('mirrorCard'),
    progressCircle: document.getElementById('progressCircle'),
    todayTotal: document.getElementById('todayTotal'),
    reflectionBadge: document.getElementById('reflectionBadge'),
    reflectionLevel: document.getElementById('reflectionLevel'),
    reflectionQuote: document.getElementById('reflectionQuote'),
    
    weeklyAverage: document.getElementById('weeklyAverage'),
    currentStreak: document.getElementById('currentStreak'),
    completionRate: document.getElementById('completionRate'),

    // Collapsible Console
    consoleToggleBtn: document.getElementById('consoleToggleBtn'),
    consoleParent: document.querySelector('.analytics-console'),

    heatmapContainer: document.getElementById('heatmapContainer'),
    historyTableBody: document.getElementById('historyTableBody'),
    toastContainer: document.getElementById('toastContainer'),
    
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    exportPdfBtn: document.getElementById('exportPdfBtn'),
    exportJsonBtn: document.getElementById('exportJsonBtn')
  };

  // --- INITIALIZATION ---
  async function init() {
    // Set active date input value to today
    el.evalDate.value = activeDate;
    
    // Load light/dark theme preference
    const savedTheme = localStorage.getItem('auraTrack_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Bind Event Listeners
    setupEventListeners();
    registerServiceWorker();
    
    // Load config and evaluations
    await loadInitialData();
    
    // Initialize active entry (check draft or load from history)
    loadEntryForDate(activeDate);

    // Initialize Lucide Icons
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // PWA install prompt
    if (el.installAppBtn) {
      el.installAppBtn.addEventListener('click', async () => {
        if (!deferredInstallPrompt) {
          showToast('Use your browser menu to add AuraTrack to the home screen', 'warning');
          return;
        }

        deferredInstallPrompt.prompt();
        const { outcome } = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        el.installAppBtn.hidden = true;

        if (outcome === 'accepted') {
          showToast('AuraTrack install started', 'success');
        }
      });
    }

    // Date Change
    el.evalDate.addEventListener('change', (e) => {
      saveDraft(); // Save draft for old date first
      activeDate = e.target.value;
      loadEntryForDate(activeDate);
    });

    // Save Button
    el.saveBtn.addEventListener('click', saveActiveEntry);

    // Reset Button
    el.resetBtn.addEventListener('click', () => {
      if (confirm('Reset inputs for the current date to baseline defaults?')) {
        activeEntry = createEmptyEntry(activeDate);
        renderActiveEntry();
        showToast('Form reset to defaults', 'warning');
      }
    });

    // Theme Toggle
    el.themeToggle.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('auraTrack_theme', newTheme);
      
      // Update Chart designs
      updateChartsTheme();
      showToast(`Switched to ${newTheme} mode`, 'success');
    });

    // Collapsible Console Toggle
    if (el.consoleToggleBtn && el.consoleParent) {
      el.consoleToggleBtn.addEventListener('click', () => {
        el.consoleParent.classList.toggle('expanded');
      });
    }

    // Modal Triggers
    el.settingsBtn.addEventListener('click', openSettingsModal);
    el.closeSettings.addEventListener('click', () => el.settingsModal.classList.remove('active'));
    el.saveSettingsBtn.addEventListener('click', saveSettings);
    el.clearAllBtn.addEventListener('click', wipeAllData);
    if (el.clearClientCacheBtn) {
      el.clearClientCacheBtn.addEventListener('click', clearClientCache);
    }

    el.importBtn.addEventListener('click', () => el.importModal.classList.add('active'));
    el.closeImport.addEventListener('click', () => el.importModal.classList.remove('active'));
    
    el.importFile.addEventListener('change', (e) => {
      el.submitImportBtn.disabled = !e.target.files.length;
    });
    
    el.submitImportBtn.addEventListener('click', handleImport);

    // Exports
    el.exportCsvBtn.addEventListener('click', exportCSV);
    el.exportPdfBtn.addEventListener('click', exportPDF);
    el.exportJsonBtn.addEventListener('click', backupJSON);

    // Mood picker buttons binding
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        activeEntry.mood = parseInt(this.dataset.mood);
        saveDraft();
      });
    });

    // Journal notes keyup
    el.journalNotes.addEventListener('input', (e) => {
      activeEntry.notes = e.target.value;
      saveDraft();
    });
  }

  // --- PWA INSTALLATION ---
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .catch((err) => console.warn('Service worker registration failed:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      if (el.installAppBtn) {
        el.installAppBtn.hidden = false;
      }
    });

    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      if (el.installAppBtn) {
        el.installAppBtn.hidden = true;
      }
      showToast('AuraTrack installed successfully', 'success');
    });
  }

  // --- API SYNC AND LOCAL BACKUPS ---
  async function loadInitialData() {
    try {
      // Test server connection and fetch config
      const configRes = await fetch('/api/config');
      if (!configRes.ok) throw new Error('Backend server configuration error');
      appConfig = await configRes.json();
      
      const evalsRes = await fetch('/api/evaluations');
      if (!evalsRes.ok) throw new Error('Backend server evaluations fetch error');
      evaluations = await evalsRes.json();
      
      isServerOnline = true;
      updateSyncBadge(true);
      
      // Backup to LocalStorage
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(appConfig));
      localStorage.setItem(LS_EVALS_KEY, JSON.stringify(evaluations));
    } catch (err) {
      console.warn('Backend server offline, falling back to LocalStorage:', err);
      isServerOnline = false;
      updateSyncBadge(false);
      
      // Load offline cache
      const cachedConfig = localStorage.getItem(LS_CONFIG_KEY);
      const cachedEvals = localStorage.getItem(LS_EVALS_KEY);
      
      if (cachedConfig) {
        appConfig = JSON.parse(cachedConfig);
      } else {
        // Fallback default
        appConfig = {
          targetCredits: 20,
          frames: [
            { id: 'pre', label: 'Pre-College', maxCredits: 8, habits: ['Wake up on time', 'Morning exercise', 'Healthy breakfast', 'Focus study session'] },
            { id: 'college', label: 'College', maxCredits: 10, habits: ['Attend all classes', 'Take notes', 'Active participation', 'Library time'] },
            { id: 'post', label: 'Post-College', maxCredits: 7, habits: ['Gym / Work-out', 'Code / Project work', 'Read book', 'Sleep routine'] }
          ]
        };
      }
      
      evaluations = cachedEvals ? JSON.parse(cachedEvals) : [];
      showToast('Offline Mode: Data saved locally in browser', 'warning');
    }
    
    // Refresh GUI elements
    refreshDashboard();
  }

  function updateSyncBadge(online) {
    if (online) {
      el.syncStatus.classList.remove('offline');
      el.syncStatus.querySelector('.status-text').textContent = 'Connected';
    } else {
      el.syncStatus.classList.add('offline');
      el.syncStatus.querySelector('.status-text').textContent = 'Offline (Local)';
    }
  }

  // --- HELPER CONSTRUCTORS ---
  function createEmptyEntry(date) {
    const defaultScores = {};
    const defaultHabits = {};
    
    appConfig.frames.forEach(frame => {
      defaultScores[frame.id] = 5; // Start sliders mid-way (5/10)
      defaultHabits[frame.id] = []; // Empty checked habits list
    });
    
    return {
      date: date,
      scores: defaultScores,
      habits: defaultHabits,
      mood: 4, // Default neutral-happy mood
      notes: ''
    };
  }

  function calculateEntryCredits(entry) {
    let total = 0;
    appConfig.frames.forEach(frame => {
      const score = entry.scores[frame.id] || 0;
      total += (score / 10) * frame.maxCredits;
    });
    return parseFloat(total.toFixed(2));
  }

  // --- DRAFT AUTOMATIONS ---
  function saveDraft() {
    localStorage.setItem(LS_DRAFT_KEY, JSON.stringify({
      date: activeDate,
      entry: activeEntry
    }));
  }

  function loadEntryForDate(date) {
    // 1. Check draft first
    try {
      const draftRaw = localStorage.getItem(LS_DRAFT_KEY);
      if (draftRaw) {
        const draft = JSON.parse(draftRaw);
        if (draft.date === date && draft.entry) {
          activeEntry = draft.entry;
          // Ensure all configuration categories exist (in case config changed)
          validateActiveEntryStructure();
          renderActiveEntry();
          updateKPIs();
          return;
        }
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }

    // 2. Check historical evaluations
    const historyEntry = evaluations.find(e => e.date === date);
    if (historyEntry) {
      // Deep clone to avoid mutating history directly
      activeEntry = JSON.parse(JSON.stringify(historyEntry));
    } else {
      activeEntry = createEmptyEntry(date);
    }
    
    validateActiveEntryStructure();
    renderActiveEntry();
    updateKPIs();
  }

  function validateActiveEntryStructure() {
    if (!activeEntry.scores) activeEntry.scores = {};
    if (!activeEntry.habits) activeEntry.habits = {};
    
    appConfig.frames.forEach(frame => {
      if (activeEntry.scores[frame.id] === undefined) {
        activeEntry.scores[frame.id] = 5;
      }
      if (!Array.isArray(activeEntry.habits[frame.id])) {
        activeEntry.habits[frame.id] = [];
      }
    });
  }

  // --- RENDERING FORM INPUTS ---
  function renderActiveEntry() {
    // Set notes text
    el.journalNotes.value = activeEntry.notes || '';
    
    // Set active mood button styling
    document.querySelectorAll('.mood-btn').forEach(btn => {
      btn.classList.remove('active');
      if (parseInt(btn.dataset.mood) === activeEntry.mood) {
        btn.classList.add('active');
      }
    });

    // Populate categories dynamically
    el.categoriesContainer.innerHTML = '';
    
    appConfig.frames.forEach(frame => {
      const score = activeEntry.scores[frame.id];
      const maxCr = frame.maxCredits;
      const credits = ((score / 10) * maxCr).toFixed(1);
      
      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.id = frame.id;
      
      // Header
      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <span class="category-title">${frame.label}</span>
        <span class="category-max">max ${maxCr} cr</span>
      `;
      card.appendChild(header);

      // Habits list (if any exist)
      if (frame.habits && frame.habits.length > 0) {
        const habitsContainer = document.createElement('div');
        habitsContainer.className = 'habit-checkbox-grid';
        
        frame.habits.forEach(habit => {
          const isChecked = activeEntry.habits[frame.id] && activeEntry.habits[frame.id].includes(habit);
          const label = document.createElement('label');
          label.className = `habit-checkbox-label ${isChecked ? 'checked' : ''}`;
          label.innerHTML = `
            <input type="checkbox" class="habit-checkbox" data-frame="${frame.id}" data-habit="${habit}" ${isChecked ? 'checked' : ''}>
            <span>${habit}</span>
          `;
          
          // Checkbox Listener
          label.querySelector('input').addEventListener('change', function() {
            if (this.checked) {
              label.classList.add('checked');
            } else {
              label.classList.remove('checked');
            }
            handleHabitChange(frame.id, habit, this.checked);
          });
          
          habitsContainer.appendChild(label);
        });
        card.appendChild(habitsContainer);
      }

      // Slider controls
      const sliderRow = document.createElement('div');
      sliderRow.className = 'range-control-row';
      
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'range-slider';
      slider.min = '0';
      slider.max = '10';
      slider.step = '0.5';
      slider.value = score;
      slider.dataset.frame = frame.id;
      
      const sliderVal = document.createElement('span');
      sliderVal.className = 'slider-value';
      sliderVal.textContent = score.toFixed(1);
      
      sliderRow.appendChild(slider);
      sliderRow.appendChild(sliderVal);
      card.appendChild(sliderRow);

      // Credits Display
      const readout = document.createElement('div');
      readout.className = 'credit-readout';
      readout.innerHTML = `
        <span>Earned credits</span>
        <strong id="readout-${frame.id}">${credits} / ${maxCr} cr</strong>
      `;
      card.appendChild(readout);

      // Slider listener
      slider.addEventListener('input', function() {
        const newScore = parseFloat(this.value);
        activeEntry.scores[frame.id] = newScore;
        sliderVal.textContent = newScore.toFixed(1);
        
        const newCredits = ((newScore / 10) * maxCr).toFixed(1);
        document.getElementById(`readout-${frame.id}`).textContent = `${newCredits} / ${maxCr} cr`;
        
        updateKPIs();
        saveDraft();
      });

      el.categoriesContainer.appendChild(card);
    });
  }

  function handleHabitChange(frameId, habitName, isChecked) {
    const list = activeEntry.habits[frameId] || [];
    if (isChecked) {
      if (!list.includes(habitName)) list.push(habitName);
    } else {
      const idx = list.indexOf(habitName);
      if (idx >= 0) list.splice(idx, 1);
    }
    activeEntry.habits[frameId] = list;

    // Recalculate timeframe slider score based on checked checklist fraction
    const frame = appConfig.frames.find(f => f.id === frameId);
    if (frame && frame.habits && frame.habits.length > 0) {
      const checkedCount = list.filter(h => frame.habits.includes(h)).length;
      const totalCount = frame.habits.length;
      const autoScore = parseFloat(((checkedCount / totalCount) * 10).toFixed(1));
      
      // Update entry & slider view
      activeEntry.scores[frameId] = autoScore;
      const slider = el.categoriesContainer.querySelector(`input[data-frame="${frameId}"]`);
      if (slider) {
        slider.value = autoScore;
        slider.nextElementSibling.textContent = autoScore.toFixed(1);
      }
      
      const newCredits = ((autoScore / 10) * frame.maxCredits).toFixed(1);
      document.getElementById(`readout-${frameId}`).textContent = `${newCredits} / ${frame.maxCredits} cr`;
    }

    updateKPIs();
    saveDraft();
  }

  // --- SAVE OPERATION ---
  async function saveActiveEntry() {
    try {
      let res;
      if (isServerOnline) {
        res = await fetch('/api/evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeEntry)
        });
        
        if (!res.ok) throw new Error('Server returned save failure status');
        
        const payload = await res.json();
        // Update local memory list
        const idx = evaluations.findIndex(e => e.date === activeEntry.date);
        if (idx >= 0) {
          evaluations[idx] = payload.entry;
        } else {
          evaluations.push(payload.entry);
        }
      } else {
        // Save in LocalStorage cache
        const idx = evaluations.findIndex(e => e.date === activeEntry.date);
        if (idx >= 0) {
          evaluations[idx] = JSON.parse(JSON.stringify(activeEntry));
        } else {
          evaluations.push(JSON.parse(JSON.stringify(activeEntry)));
        }
        localStorage.setItem(LS_EVALS_KEY, JSON.stringify(evaluations));
      }

      // Remove current draft
      localStorage.removeItem(LS_DRAFT_KEY);

      showToast(`Evaluation for ${activeDate} saved successfully`, 'success');
      
      // Refresh UI elements
      refreshDashboard();
      
    } catch (err) {
      console.error('Failed to save evaluation:', err);
      showToast('Save failed: falling back to local memory', 'danger');
      
      // Local fallback
      const idx = evaluations.findIndex(e => e.date === activeEntry.date);
      if (idx >= 0) {
        evaluations[idx] = JSON.parse(JSON.stringify(activeEntry));
      } else {
        evaluations.push(JSON.parse(JSON.stringify(activeEntry)));
      }
      localStorage.setItem(LS_EVALS_KEY, JSON.stringify(evaluations));
      isServerOnline = false;
      updateSyncBadge(false);
      
      refreshDashboard();
    }
  }

  // --- REFRESH ALL DISPLAY WIDGETS ---
  function refreshDashboard() {
    // Sort evaluations
    evaluations.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    updateKPIs();
    renderHeatmap();
    renderHistoryTable();
    renderCharts();
  }

  // --- SELF-MIRROR ENGINE AND KPI CALCULATIONS ---
  function updateKPIs() {
    // Today's credits
    const activeTotal = calculateEntryCredits(activeEntry);
    el.todayTotal.textContent = activeTotal.toFixed(1);
    
    // Update circular gauge and self-mirror status
    updateSelfMirror(activeTotal);

    // 7-day average credits
    let last7DaysTotal = 0;
    let last7DaysCount = 0;
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const checkDateObj = new Date();
      checkDateObj.setDate(today.getDate() - i);
      const checkDateStr = checkDateObj.toISOString().slice(0, 10);
      
      const record = evaluations.find(e => e.date === checkDateStr);
      if (record) {
        last7DaysTotal += calculateEntryCredits(record);
        last7DaysCount++;
      }
    }
    
    const weeklyAvg = last7DaysCount > 0 ? (last7DaysTotal / last7DaysCount) : 0;
    el.weeklyAverage.textContent = weeklyAvg.toFixed(1);

    // Streaks
    const streakData = getStreaks(evaluations);
    el.currentStreak.textContent = streakData.current;

    // Completion Rate (last 30 days)
    let evaluatedCount = 0;
    for (let i = 0; i < 30; i++) {
      const checkDateObj = new Date();
      checkDateObj.setDate(today.getDate() - i);
      const checkDateStr = checkDateObj.toISOString().slice(0, 10);
      if (evaluations.some(e => e.date === checkDateStr)) {
        evaluatedCount++;
      }
    }
    const rate = Math.round((evaluatedCount / 30) * 100);
    el.completionRate.textContent = `${rate}%`;
  }

  // Self Mirror Threshold and Content updates
  function updateSelfMirror(credits) {
    // Circumference of circular gauge (r=74) is 465px
    const circumference = 465;
    const percent = Math.max(0, Math.min(25, credits)) / 25;
    const offset = circumference - (percent * circumference);
    
    if (el.progressCircle) {
      el.progressCircle.style.strokeDashoffset = offset;
    }

    // Determine Status
    let statusId = 'failure';
    let badgeText = 'SLACKING';
    let levelText = 'FAILURE';
    let quote = 'A day without discipline is a step backward. Pick yourself up tomorrow.';
    let circleColor = '#f43f5e'; // Rose Red

    if (credits < 10) {
      statusId = 'failure';
      badgeText = 'SLACKING';
      levelText = 'FAILURE';
      quote = 'A day without discipline is a step backward. Pick yourself up tomorrow.';
      circleColor = '#f43f5e';
    } else if (credits < 17.5) {
      statusId = 'mediocre';
      badgeText = 'AVERAGE';
      levelText = 'MEDIOCRE';
      quote = 'Average effort leads to average results. Break past your limits.';
      circleColor = '#f59e0b'; // Amber Gold
    } else if (credits < 22) {
      statusId = 'good';
      badgeText = 'DISCIPLINED';
      levelText = 'GOOD';
      quote = 'Consistency is building your empire. You are on the right path!';
      circleColor = '#06b6d4'; // Cyan
    } else {
      statusId = 'elite';
      badgeText = 'FLOW STATE';
      levelText = 'ELITE FLOW';
      quote = 'Operating in the top 1%. You are completely unstoppable today!';
      circleColor = '#10b981'; // Emerald Green
    }

    // Modify mirror card theme classes
    if (el.mirrorCard) {
      el.mirrorCard.className = `glass-panel mirror-card status-${statusId}`;
    }

    // Update texts
    if (el.reflectionBadge) el.reflectionBadge.textContent = badgeText;
    if (el.reflectionLevel) el.reflectionLevel.textContent = levelText;
    if (el.reflectionQuote) el.reflectionQuote.textContent = quote;
    
    // Update SVG stroke color
    if (el.progressCircle) {
      el.progressCircle.setAttribute('stroke', circleColor);
    }
  }

  function getStreaks(evals) {
    if (!evals.length) return { current: 0, longest: 0 };
    
    // Extract dates, parse, sort ascending
    const dates = Array.from(new Set(evals.map(e => e.date)))
      .map(d => new Date(d))
      .sort((a, b) => a - b);
      
    let longest = 0;
    let current = 0;
    let tempStreak = 0;
    let prevDate = null;

    dates.forEach(d => {
      if (prevDate === null) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(d - prevDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          tempStreak++;
        } else if (diffDays > 1) {
          if (tempStreak > longest) longest = tempStreak;
          tempStreak = 1;
        }
      }
      prevDate = d;
    });
    
    if (tempStreak > longest) longest = tempStreak;

    // Calculate current streak (must connect to today or yesterday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const hasToday = evals.some(e => new Date(e.date).getTime() === today.getTime());
    const hasYesterday = evals.some(e => new Date(e.date).getTime() === yesterday.getTime());
    
    if (hasToday || hasYesterday) {
      // Trace backwards from latest date in the streak
      let checkDate = hasToday ? today : yesterday;
      current = 0;
      while (true) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (evals.some(e => e.date === dateStr)) {
          current++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    } else {
      current = 0;
    }

    return { current, longest: Math.max(longest, current) };
  }

  // --- SVG HEATMAP CALENDAR GENERATION ---
  function renderHeatmap() {
    el.heatmapContainer.innerHTML = '';
    
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 720 110');
    svg.setAttribute('class', 'heatmap-svg');

    const cellSize = 10;
    const cellGap = 2.5;
    const textPadding = 20;

    // Date range: 365 days ago to today
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 364);
    
    // Adjust start date to the beginning of its week (Sunday)
    const startOffset = startDate.getDay();
    startDate.setDate(startDate.getDate() - startOffset);

    // Map evaluations by date
    const evalMap = {};
    evaluations.forEach(e => {
      evalMap[e.date] = calculateEntryCredits(e);
    });

    const moodsMap = {};
    evaluations.forEach(e => {
      moodsMap[e.date] = e.mood;
    });

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    dayLabels.forEach((label, idx) => {
      if (idx % 2 === 1) {
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', 15 + idx * (cellSize + cellGap) + 8);
        text.setAttribute('font-size', '8px');
        text.setAttribute('fill', 'var(--text-muted)');
        text.textContent = label;
        svg.appendChild(text);
      }
    });

    const curDate = new Date(startDate);
    let colIdx = 0;
    let lastMonth = -1;

    while (curDate <= endDate) {
      const weekDay = curDate.getDay();
      const dateStr = curDate.toISOString().slice(0, 10);
      
      const credits = evalMap[dateStr];
      const mood = moodsMap[dateStr];
      
      let level = 0;
      if (credits !== undefined) {
        if (credits === 0) level = 0;
        else if (credits <= 8) level = 1;
        else if (credits <= 15) level = 2;
        else if (credits <= 22) level = 3;
        else level = 4;
      }

      // Add month headers
      if (weekDay === 0 && curDate.getMonth() !== lastMonth) {
        const monthHeader = document.createElementNS(svgNS, 'text');
        monthHeader.setAttribute('x', textPadding + colIdx * (cellSize + cellGap));
        monthHeader.setAttribute('y', '9');
        monthHeader.setAttribute('font-size', '8px');
        monthHeader.setAttribute('font-weight', '600');
        monthHeader.setAttribute('fill', 'var(--text-muted)');
        monthHeader.textContent = monthLabels[curDate.getMonth()];
        svg.appendChild(monthHeader);
        lastMonth = curDate.getMonth();
      }

      // Draw day rect
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('x', textPadding + colIdx * (cellSize + cellGap));
      rect.setAttribute('y', 15 + weekDay * (cellSize + cellGap));
      rect.setAttribute('width', cellSize);
      rect.setAttribute('height', cellSize);
      rect.setAttribute('class', `heatmap-cell level-${level}`);
      
      const moodEmoji = mood ? ['😢', '😕', '😐', '🙂', '😄'][mood - 1] : '—';
      const tooltipText = credits !== undefined 
        ? `${dateStr}: ${credits.toFixed(1)} cr (Mood: ${moodEmoji})`
        : `${dateStr}: No Entry`;
        
      const title = document.createElementNS(svgNS, 'title');
      title.textContent = tooltipText;
      rect.appendChild(title);
      
      rect.style.cursor = 'pointer';
      rect.addEventListener('click', () => {
        el.evalDate.value = dateStr;
        activeDate = dateStr;
        loadEntryForDate(activeDate);
        showToast(`Loaded details for ${dateStr}`, 'success');
      });

      svg.appendChild(rect);

      curDate.setDate(curDate.getDate() + 1);
      if (weekDay === 6) colIdx++;
    }

    el.heatmapContainer.appendChild(svg);
  }

  // --- CHART RENDERING (Chart.js) ---
  function renderCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#9ca3af' : '#64748b';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    
    // --- 1. TREND LINE CHART ---
    const trendData = [...evaluations]
      .slice(0, 15)
      .reverse();
      
    const labels = trendData.map(e => e.date.substring(5)); // Show MM-DD format
    const creditPoints = trendData.map(e => calculateEntryCredits(e));
    const baselinePoints = Array(labels.length).fill(appConfig.targetCredits);

    if (trendChartInstance) {
      trendChartInstance.destroy();
    }

    const ctxTrend = document.getElementById('trendChart').getContext('2d');
    
    const primaryGrad = ctxTrend.createLinearGradient(0, 0, 0, 200);
    primaryGrad.addColorStop(0, 'rgba(124, 58, 237, 0.4)');
    primaryGrad.addColorStop(1, 'rgba(124, 58, 237, 0.0)');

    trendChartInstance = new Chart(ctxTrend, {
      type: 'line',
      data: {
        labels: labels.length ? labels : ['No Data'],
        datasets: [
          {
            label: 'Credits',
            data: creditPoints.length ? creditPoints : [0],
            borderColor: '#7c3aed',
            backgroundColor: primaryGrad,
            borderWidth: 3,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#7c3aed',
            pointBorderColor: isDark ? '#0d0e1c' : '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Target',
            data: baselinePoints.length ? baselinePoints : [appConfig.targetCredits],
            borderColor: '#06b6d4',
            borderWidth: 2,
            borderDash: [6, 6],
            fill: false,
            pointRadius: 0,
            pointHoverRadius: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: 10 } }
          },
          tooltip: {
            padding: 10,
            titleFont: { family: 'Outfit', weight: '700' },
            bodyFont: { family: 'Plus Jakarta Sans' }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 9 } }
          },
          y: {
            min: 0,
            max: 25,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 9 } }
          }
        }
      }
    });

    // --- 2. CATEGORY SPLIT PIE/RADAR CHART ---
    const catAverages = {};
    appConfig.frames.forEach(frame => {
      catAverages[frame.id] = 0;
    });

    if (evaluations.length > 0) {
      evaluations.forEach(entry => {
        appConfig.frames.forEach(frame => {
          const score = entry.scores[frame.id] !== undefined ? entry.scores[frame.id] : 5;
          catAverages[frame.id] += (score / 10) * frame.maxCredits;
        });
      });
      appConfig.frames.forEach(frame => {
        catAverages[frame.id] = parseFloat((catAverages[frame.id] / evaluations.length).toFixed(1));
      });
    }

    const catLabels = appConfig.frames.map(f => f.label);
    const catData = appConfig.frames.map(f => catAverages[f.id]);
    const maxDataColors = ['#7c3aed', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

    if (splitChartInstance) {
      splitChartInstance.destroy();
    }

    const ctxSplit = document.getElementById('splitChart').getContext('2d');
    
    splitChartInstance = new Chart(ctxSplit, {
      type: 'doughnut',
      data: {
        labels: catLabels.length ? catLabels : ['None'],
        datasets: [{
          data: catData.length ? catData : [1],
          backgroundColor: maxDataColors.slice(0, catLabels.length),
          borderWidth: isDark ? 2 : 1,
          borderColor: isDark ? '#0d0e1c' : '#fff',
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600', size: 10 } }
          },
          tooltip: {
            padding: 10,
            callbacks: {
              label: function(context) {
                return ` Avg: ${context.raw.toFixed(1)} credits`;
              }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  function updateChartsTheme() {
    renderCharts();
    renderHeatmap();
  }

  // --- HISTORICAL LOG TABLE ---
  function renderHistoryTable() {
    el.historyTableBody.innerHTML = '';
    
    const historyTable = document.getElementById('historyTable');
    if (historyTable) {
      const headerRow = historyTable.querySelector('thead tr');
      if (headerRow) {
        const catHeaders = appConfig.frames.map(f => `<th class="hide-on-mobile">${f.label}</th>`).join('');
        headerRow.innerHTML = `
          <th>Date</th>
          <th>Mood</th>
          ${catHeaders}
          <th>Total Credits</th>
          <th class="hide-on-mobile">Journal Highlights</th>
          <th>Actions</th>
        `;
      }
    }
    
    if (evaluations.length === 0) {
      const colSpan = 5 + appConfig.frames.length;
      el.historyTableBody.innerHTML = `
        <tr>
          <td colspan="${colSpan}" class="empty-state">
            No entries found. Fill out today's score above to begin tracking.
          </td>
        </tr>
      `;
      return;
    }

    evaluations.forEach(entry => {
      const credits = calculateEntryCredits(entry);
      
      const tr = document.createElement('tr');
      const moodEmojis = ['😢', '😕', '😐', '🙂', '😄'];
      const emoji = moodEmojis[(entry.mood || 3) - 1];

      const segmentCellContents = appConfig.frames.map(frame => {
        const score = entry.scores[frame.id] !== undefined ? entry.scores[frame.id] : 5;
        const cr = ((score / 10) * frame.maxCredits).toFixed(1);
        return `<td class="hide-on-mobile">${score} <span class="text-muted" style="font-size:0.75rem">(${cr} cr)</span></td>`;
      }).join('');
      
      tr.innerHTML = `
        <td style="font-weight: 700">${entry.date}</td>
        <td class="table-mood" title="Mood index: ${entry.mood}">${emoji}</td>
        ${segmentCellContents}
        <td class="table-credits-total">${credits.toFixed(1)} cr</td>
        <td class="table-notes-cell hide-on-mobile" title="${escapeHTML(entry.notes || '')}">
          ${escapeHTML(entry.notes || '—')}
        </td>
        <td>
          <div class="table-actions">
            <button class="table-btn load-btn" data-date="${entry.date}">Load</button>
            <button class="table-btn delete-btn" data-date="${entry.date}">Delete</button>
          </div>
        </td>
      `;

      tr.querySelector('.load-btn').addEventListener('click', () => {
        el.evalDate.value = entry.date;
        activeDate = entry.date;
        loadEntryForDate(activeDate);
        window.scrollTo({ top: el.evalDate.offsetTop - 120, behavior: 'smooth' });
        showToast(`Loaded ${entry.date} into edit form`, 'success');
      });

      tr.querySelector('.delete-btn').addEventListener('click', async () => {
        if (confirm(`Are you sure you want to delete the evaluation for ${entry.date}?`)) {
          await deleteEntry(entry.date);
        }
      });

      el.historyTableBody.appendChild(tr);
    });
  }

  async function deleteEntry(date) {
    try {
      if (isServerOnline) {
        const res = await fetch(`/api/evaluations/${date}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('API delete call failed');
      }
      
      evaluations = evaluations.filter(e => e.date !== date);
      localStorage.setItem(LS_EVALS_KEY, JSON.stringify(evaluations));
      
      if (activeDate === date) {
        activeEntry = createEmptyEntry(activeDate);
        renderActiveEntry();
      }
      
      showToast(`Deleted evaluation for ${date}`, 'success');
      refreshDashboard();
      
    } catch (err) {
      console.error('Failed to delete entry:', err);
      showToast('Delete failed: falling back to local deletion', 'danger');
      
      evaluations = evaluations.filter(e => e.date !== date);
      localStorage.setItem(LS_EVALS_KEY, JSON.stringify(evaluations));
      
      isServerOnline = false;
      updateSyncBadge(false);
      
      refreshDashboard();
    }
  }

  // --- SETTINGS DRAWER FUNCTIONS ---
  function openSettingsModal() {
    el.settingsTargetCredits.value = appConfig.targetCredits;
    el.categoryConfigurator.innerHTML = '';

    appConfig.frames.forEach((frame, idx) => {
      const card = document.createElement('div');
      card.className = 'config-category-card';
      card.dataset.id = frame.id;
      
      card.innerHTML = `
        <div class="config-category-meta">
          <input type="text" class="config-label-input" value="${frame.label}" placeholder="Category Name" title="Name">
          <input type="number" class="config-credits-input" min="1" max="25" value="${frame.maxCredits}" placeholder="Max Credits" title="Max Credits Allocation">
        </div>
        <div class="config-habits-editor">
          <span class="slider-label" style="margin-bottom:4px">Linked Habits</span>
          <div class="habits-list-config" id="habitsListConfig-${frame.id}">
            <!-- habit entries -->
          </div>
          <button type="button" class="btn secondary-btn compact add-habit-btn" style="margin-top:6px" data-frame-id="${frame.id}">
            <i data-lucide="plus"></i> Add Habit
          </button>
        </div>
      `;

      const habitsList = card.querySelector(`.habits-list-config`);
      const habits = frame.habits || [];
      habits.forEach((habit, hIdx) => {
        addHabitRowToConfig(habitsList, frame.id, habit);
      });

      card.querySelector('.add-habit-btn').addEventListener('click', function() {
        addHabitRowToConfig(habitsList, frame.id, '');
        if (window.lucide) lucide.createIcons();
      });

      el.categoryConfigurator.appendChild(card);
    });

    if (window.lucide) {
      lucide.createIcons();
    }
    el.settingsModal.classList.add('active');
  }

  function addHabitRowToConfig(container, frameId, textValue) {
    const row = document.createElement('div');
    row.className = 'config-habit-row';
    row.innerHTML = `
      <input type="text" class="config-habit-text" value="${escapeHTML(textValue)}" placeholder="E.g. Attend all lectures">
      <button type="button" class="table-btn delete-btn remove-habit-row-btn" title="Delete Habit">
        <i data-lucide="trash"></i>
      </button>
    `;
    row.querySelector('.remove-habit-row-btn').addEventListener('click', () => {
      row.remove();
    });
    container.appendChild(row);
  }

  async function saveSettings() {
    const newTarget = parseInt(el.settingsTargetCredits.value) || 20;
    const newFrames = [];
    
    let sumMaxCredits = 0;
    const configCards = el.categoryConfigurator.querySelectorAll('.config-category-card');
    
    configCards.forEach(card => {
      const id = card.dataset.id;
      const label = card.querySelector('.config-label-input').value.trim() || id;
      const maxCr = parseFloat(card.querySelector('.config-credits-input').value) || 5;
      
      const habits = [];
      card.querySelectorAll('.config-habit-text').forEach(input => {
        const text = input.value.trim();
        if (text) habits.push(text);
      });

      newFrames.push({
        id,
        label,
        maxCredits: maxCr,
        habits
      });

      sumMaxCredits += maxCr;
    });

    if (sumMaxCredits !== 25) {
      if (!confirm(`Warning: The sum of category maximum credits is ${sumMaxCredits} cr. The standard score is out of 25.0 cr. Do you want to continue?`)) {
        return;
      }
    }

    const updatedConfig = {
      targetCredits: newTarget,
      frames: newFrames
    };

    try {
      if (isServerOnline) {
        const res = await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedConfig)
        });
        if (!res.ok) throw new Error('API save settings failed');
      }

      appConfig = updatedConfig;
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(appConfig));
      
      showToast('Configurations updated successfully', 'success');
      el.settingsModal.classList.remove('active');
      
      loadEntryForDate(activeDate);
      refreshDashboard();

    } catch (err) {
      console.error('Failed to save configurations:', err);
      showToast('Save failed, running with offline values', 'danger');
      
      appConfig = updatedConfig;
      localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(appConfig));
      
      isServerOnline = false;
      updateSyncBadge(false);
      
      el.settingsModal.classList.remove('active');
      loadEntryForDate(activeDate);
      refreshDashboard();
    }
  }

  async function wipeAllData() {
    if (!confirm('🚨 WARNING: This will permanently delete ALL evaluations, server backup histories, and configs. This cannot be undone. Are you absolutely sure?')) {
      return;
    }

    try {
      if (isServerOnline) {
        const res = await fetch('/api/reset', {
          method: 'POST'
        });
        if (!res.ok) throw new Error('Server reset endpoint failed');
      }
    } catch (e) {
      console.error('Server wipe failed:', e);
      showToast('Wipe failed on server, resetting client only', 'danger');
    }

    // Clear client
    localStorage.removeItem(LS_CONFIG_KEY);
    localStorage.removeItem(LS_EVALS_KEY);
    localStorage.removeItem(LS_DRAFT_KEY);

    showToast('Hard reset successful! App is restarting...', 'danger');
    el.settingsModal.classList.remove('active');
    
    // Force reload
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  async function clearClientCache() {
    if (!confirm('This will wipe all client cache stored in LocalStorage and perform a fresh resync from the server. Do you want to proceed?')) {
      return;
    }
    
    // Clear LocalStorage cache
    localStorage.removeItem(LS_CONFIG_KEY);
    localStorage.removeItem(LS_EVALS_KEY);
    localStorage.removeItem(LS_DRAFT_KEY);
    
    showToast('Client cache cleared! Reloading...', 'warning');
    
    // Force a fresh window reload to reload state from server
    setTimeout(() => {
      window.location.reload();
    }, 800);
  }

  // --- DATA PORTABILITY: EXPORT / IMPORT ---
  function exportCSV() {
    if (!evaluations.length) return showToast('No evaluations to export', 'warning');
    
    const categoryHeaders = appConfig.frames.map(f => `${f.label} Score,${f.label} Credits`).join(',');
    const headers = `Date,Mood Index,${categoryHeaders},Total Credits,Journal Notes\n`;
    
    const rows = evaluations.map(e => {
      const catCols = appConfig.frames.map(f => {
        const score = e.scores[f.id] !== undefined ? e.scores[f.id] : 5;
        const cr = ((score / 10) * f.maxCredits).toFixed(1);
        return `${score},${cr}`;
      }).join(',');
      
      const total = calculateEntryCredits(e).toFixed(1);
      const cleanNotes = (e.notes || '').replace(/"/g, '""');
      
      return `${e.date},${e.mood},${catCols},${total},"${cleanNotes}"`;
    }).join('\n');

    triggerFileDownload(headers + rows, `aura_track_export_${activeDate}.csv`, 'text/csv;charset=utf-8;');
    showToast('CSV exported successfully', 'success');
  }

  function backupJSON() {
    if (!evaluations.length) return showToast('No evaluations to back up', 'warning');
    
    const backupObj = {
      version: 'aura-track-v3',
      exportDate: new Date().toISOString(),
      config: appConfig,
      evaluations: evaluations
    };

    triggerFileDownload(JSON.stringify(backupObj, null, 2), `auratrack_backup_${activeDate}.json`, 'application/json');
    showToast('JSON backup file downloaded', 'success');
  }

  async function handleImport() {
    const file = el.importFile.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        let importList = [];
        
        if (parsed.evaluations && Array.isArray(parsed.evaluations)) {
          importList = parsed.evaluations;
          if (parsed.config) {
            appConfig = parsed.config;
            localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(appConfig));
          }
        } else if (Array.isArray(parsed)) {
          importList = parsed;
        } else {
          throw new Error('Unsupported JSON database format');
        }

        if (isServerOnline) {
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ evaluations: importList })
          });
          if (!res.ok) throw new Error('Backend bulk import failed');
          
          const payload = await res.json();
          showToast(`Imported ${payload.count} records. Database sync complete.`, 'success');
        } else {
          const currentMap = new Map(evaluations.map(x => [x.date, x]));
          importList.forEach(item => {
            if (item && item.date && item.scores) {
              currentMap.set(item.date, item);
            }
          });
          evaluations = Array.from(currentMap.values());
          localStorage.setItem(LS_EVALS_KEY, JSON.stringify(evaluations));
          showToast(`Imported ${importList.length} records to local cache`, 'success');
        }

        el.importModal.classList.remove('active');
        el.importFile.value = '';
        el.submitImportBtn.disabled = true;

        refreshDashboard();
        loadEntryForDate(activeDate);

      } catch (err) {
        console.error('Import failed:', err);
        showToast('Import failed. Make sure to use a valid evaluations JSON file', 'danger');
      }
    };
    reader.readAsText(file);
  }

  function triggerFileDownload(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- PDF GENERATOR (High Quality) ---
  function exportPDF() {
    if (!evaluations.length) return showToast('No evaluations to generate PDF', 'warning');
    if (!window.jspdf?.jsPDF) return showToast('PDF Export library unavailable', 'danger');

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const colorPrimary = [124, 58, 237]; // Violet RGB
    const colorTextDark = [15, 23, 42]; // Slate 900 RGB
    
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 42, 'F');
    
    doc.setFillColor(...colorPrimary);
    doc.rect(0, 0, pageWidth, 4, 'F');
    
    doc.setTextColor(...colorTextDark);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('AURATRACK DISCIPLINE REPORT', 14, 18);
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleString()}  |  Total tracked evaluations: ${evaluations.length}`, 14, 25);
    
    const totals = evaluations.map(e => calculateEntryCredits(e));
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const maxVal = Math.max(...totals);
    const bestDate = evaluations[totals.indexOf(maxVal)].date;
    const streaks = getStreaks(evaluations);
    
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, 30, pageWidth - 28, 10, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`Avg Credits: ${avg.toFixed(1)} / 25.0    |    Target Goal: ${appConfig.targetCredits} cr    |    Active Streak: ${streaks.current} days (Best: ${streaks.longest} days)    |    Best Score: ${maxVal.toFixed(1)} cr (${bestDate})`, 18, 36.5);
    
    const dynamicHeaders = appConfig.frames.map(f => `${f.label}\nMax ${f.maxCredits}`);
    const tableHeaders = ['Date', 'Mood', ...dynamicHeaders, 'Total\nCredits', 'Journal Summary'];
    
    const tableRows = evaluations.map(e => {
      const dateStr = e.date;
      const moodEmojis = ['Tired', 'Unfocused', 'Fine', 'Productive', 'Peak'];
      const moodTxt = moodEmojis[(e.mood || 3) - 1];
      
      const frameScores = appConfig.frames.map(f => {
        const score = e.scores[f.id] !== undefined ? e.scores[f.id] : 5;
        const cr = ((score / 10) * f.maxCredits).toFixed(1);
        return `${score}/10 (${cr}cr)`;
      });
      
      const totalCr = calculateEntryCredits(e).toFixed(1);
      const summary = e.notes ? (e.notes.length > 55 ? e.notes.substring(0, 52) + '...' : e.notes) : '';
      
      return [dateStr, moodTxt, ...frameScores, `${totalCr} cr`, summary];
    });

    doc.autoTable({
      head: [tableHeaders],
      body: tableRows,
      startY: 48,
      margin: { horizontal: 14 },
      styles: {
        fontSize: 7.5,
        cellPadding: 3,
        valign: 'middle'
      },
      headStyles: {
        fillColor: colorPrimary,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { fontStyle: 'bold', width: 20 },
        1: { halign: 'center', width: 18 },
        ...appConfig.frames.reduce((acc, f, i) => {
          acc[i + 2] = { halign: 'center' };
          return acc;
        }, {}),
        [tableHeaders.length - 2]: { fontStyle: 'bold', halign: 'center', textColor: colorPrimary },
        [tableHeaders.length - 1]: { width: 50 }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      theme: 'grid'
    });
    
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
      doc.text('AuraTrack - Cultivate Daily Excellence', 14, pageHeight - 8);
    }

    doc.save(`auratrack_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF report generated successfully', 'success');
  }

  // --- GENERAL UTILITY FUNCTIONS ---
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconName = 'check-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    if (type === 'danger') iconName = 'alert-circle';
    
    toast.innerHTML = `
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;
    
    el.toastContainer.appendChild(toast);
    
    if (window.lucide) lucide.createIcons();
    
    setTimeout(() => toast.classList.add('show'), 50);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // Bootstrap app
  window.addEventListener('DOMContentLoaded', init);

})();
