const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Static app shell and PWA assets
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/icons', express.static(path.join(__dirname, 'icons')));
app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'manifest.webmanifest'));
});
app.get('/service-worker.js', (req, res) => {
  res.type('application/javascript');
  res.set('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'service-worker.js'));
});
app.get(['/', '/index.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Data directories & paths
const DATA_DIR = path.join(__dirname, 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const EVALUATIONS_FILE = path.join(DATA_DIR, 'evaluations.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Default Configuration
const DEFAULT_CONFIG = {
  targetCredits: 20,
  frames: [
    { id: 'pre', label: 'Pre-College', maxCredits: 8, habits: ['Wake up on time', 'Morning exercise', 'Healthy breakfast', 'Focus study session'] },
    { id: 'college', label: 'College', maxCredits: 10, habits: ['Attend all classes', 'Take notes', 'Active participation', 'Library time'] },
    { id: 'post', label: 'Post-College', maxCredits: 7, habits: ['Gym / Work-out', 'Code / Project work', 'Read book', 'Sleep routine'] }
  ]
};

// Read Config Helper
function readConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return DEFAULT_CONFIG;
    }
    const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading config file, falling back to default:', err);
    return DEFAULT_CONFIG;
  }
}

// Write Config Helper
function writeConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing config file:', err);
    return false;
  }
}

// Read Evaluations Helper
function readEvaluations() {
  try {
    if (!fs.existsSync(EVALUATIONS_FILE)) {
      fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(EVALUATIONS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (err) {
    console.error('Error reading evaluations file, returning empty array:', err);
    return [];
  }
}

// Write Evaluations Helper
function writeEvaluations(evaluations) {
  try {
    // Sort descending by date before writing
    const sorted = evaluations.sort((a, b) => new Date(b.date) - new Date(a.date));
    fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify(sorted, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing evaluations file:', err);
    return false;
  }
}

// Backup Helper with Rotation (Keep last 15 backups)
function createBackup() {
  try {
    if (!fs.existsSync(EVALUATIONS_FILE)) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `evaluations_backup_${timestamp}.json`);
    
    fs.copyFileSync(EVALUATIONS_FILE, backupPath);
    
    // Rotate backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('evaluations_backup_') && f.endsWith('.json'))
      .map(f => ({ name: f, path: path.join(BACKUP_DIR, f), time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time); // newest first
      
    if (files.length > 15) {
      files.slice(15).forEach(f => {
        try {
          fs.unlinkSync(f.path);
        } catch (e) {
          console.error('Failed to delete old backup:', f.name, e);
        }
      });
    }
  } catch (err) {
    console.error('Error creating database backup:', err);
  }
}

// --- API ENDPOINTS ---

// GET Config
app.get('/api/config', (req, res) => {
  res.json(readConfig());
});

// POST Config
app.post('/api/config', (req, res) => {
  const newConfig = req.body;
  if (!newConfig || typeof newConfig.targetCredits !== 'number' || !Array.isArray(newConfig.frames)) {
    return res.status(400).json({ error: 'Invalid configuration format' });
  }
  
  if (writeConfig(newConfig)) {
    res.json({ success: true, config: newConfig });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// GET All Evaluations
app.get('/api/evaluations', (req, res) => {
  res.json(readEvaluations());
});

// GET Single Evaluation
app.get('/api/evaluations/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }
  const evals = readEvaluations();
  const match = evals.find(e => e.date === date);
  if (!match) {
    return res.status(404).json({ error: `No evaluation found for ${date}` });
  }
  res.json(match);
});

// POST Save/Update Evaluation
app.post('/api/evaluations', (req, res) => {
  const entry = req.body;
  if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !entry.scores) {
    return res.status(400).json({ error: 'Invalid evaluation entry format' });
  }

  createBackup(); // Backup current database before making edits
  
  const evals = readEvaluations();
  const index = evals.findIndex(e => e.date === entry.date);
  
  // Basic sanitization
  const sanitizedEntry = {
    date: entry.date,
    scores: {
      pre: Math.max(0, Math.min(10, Number(entry.scores.pre || 0))),
      college: Math.max(0, Math.min(10, Number(entry.scores.college || 0))),
      post: Math.max(0, Math.min(10, Number(entry.scores.post || 0)))
    },
    habits: entry.habits || { pre: [], college: [], post: [] },
    mood: Math.max(1, Math.min(5, Number(entry.mood || 3))),
    notes: entry.notes ? String(entry.notes).trim() : ''
  };

  if (index >= 0) {
    evals[index] = sanitizedEntry;
  } else {
    evals.push(sanitizedEntry);
  }

  if (writeEvaluations(evals)) {
    res.json({ success: true, entry: sanitizedEntry });
  } else {
    res.status(500).json({ error: 'Failed to save evaluation' });
  }
});

// DELETE Evaluation
app.delete('/api/evaluations/:date', (req, res) => {
  const { date } = req.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  createBackup();
  
  const evals = readEvaluations();
  const filtered = evals.filter(e => e.date !== date);
  
  if (evals.length === filtered.length) {
    return res.status(404).json({ error: `No evaluation found for ${date}` });
  }

  if (writeEvaluations(filtered)) {
    res.json({ success: true, message: `Evaluation for ${date} deleted` });
  } else {
    res.status(500).json({ error: 'Failed to delete evaluation' });
  }
});

// POST Bulk Import Evaluations
app.post('/api/import', (req, res) => {
  const { evaluations } = req.body;
  if (!Array.isArray(evaluations)) {
    return res.status(400).json({ error: 'Evaluations must be an array' });
  }

  createBackup();
  
  const currentEvals = readEvaluations();
  const evalMap = new Map(currentEvals.map(e => [e.date, e]));

  let importedCount = 0;
  evaluations.forEach(entry => {
    if (entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && entry.scores) {
      const sanitizedEntry = {
        date: entry.date,
        scores: {
          pre: Math.max(0, Math.min(10, Number(entry.scores.pre || 0))),
          college: Math.max(0, Math.min(10, Number(entry.scores.college || 0))),
          post: Math.max(0, Math.min(10, Number(entry.scores.post || 0)))
        },
        habits: entry.habits || { pre: [], college: [], post: [] },
        mood: Math.max(1, Math.min(5, Number(entry.mood || 3))),
        notes: entry.notes ? String(entry.notes).trim() : ''
      };
      
      evalMap.set(sanitizedEntry.date, sanitizedEntry);
      importedCount++;
    }
  });

  const merged = Array.from(evalMap.values());
  if (writeEvaluations(merged)) {
    res.json({ success: true, count: importedCount, total: merged.length });
  } else {
    res.status(500).json({ error: 'Failed to import evaluations' });
  }
});

// POST Reset Database and Configuration
app.post('/api/reset', (req, res) => {
  try {
    createBackup(); // Create one final backup before wiping
    
    // Wipe evaluations
    fs.writeFileSync(EVALUATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
    
    // Reset configurations to default
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    
    // Delete all backups in backups/ directory
    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      files.forEach(file => {
        try {
          fs.unlinkSync(path.join(BACKUP_DIR, file));
        } catch (e) {
          console.error('Error deleting backup file during reset:', file, e);
        }
      });
    }

    res.json({ success: true, message: 'All server evaluations, custom configurations, and backup histories have been wiped.' });
  } catch (err) {
    console.error('Reset database failed:', err);
    res.status(500).json({ error: 'Failed to reset server data.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`   Discipline Tracker backend running locally       `);
  console.log(`   Access via browser: http://localhost:${PORT}      `);
  console.log(`====================================================`);
});
