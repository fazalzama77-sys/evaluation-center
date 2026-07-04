# AuraTrack - Premium Daily Self-Mirror & Discipline Tracker

AuraTrack is a daily self-evaluation and habit-tracking dashboard designed to act as an aesthetic, motivating **self-mirror**. It uses a structured Islamically aligned prayer-timeframe credit allocation model (maximum 25 credits per day) with customizable habits, daily checklists, energy/vibe ratings, and text reflections.

To prevent clutter, the homepage is hyper-focused on today's inputs and visual reflection, while historical logs, contribution grids, and analytics reside inside a collapsible drawer.

---

## 🔮 The Self-Mirror Status Engine

Today's performance is dynamically mapped to a visual rating theme:

| Credit Threshold | Level Status | Color Code | Motivational Mirror Feedback |
| :--- | :--- | :--- | :--- |
| **0.0 – 9.9 cr** | `FAILURE` | Crimson Red | *"A day without discipline is a step backward. Pick yourself up tomorrow."* |
| **10.0 – 17.4 cr** | `MEDIOCRE` | Amber Gold | *"Average effort leads to average results. Break past your limits."* |
| **17.5 – 21.9 cr** | `GOOD` | Cyan Blue | *"Consistency is building your empire. You are on the right path!"* |
| **22.0 – 25.0 cr** | `ELITE FLOW` | Emerald Green | *"Operating in the top 1%. You are completely unstoppable today!"* |

---

## Technical Stack & Layout

The project is structured as a full-stack Node.js + Express application:

- **Backend**: Node.js & Express server.
- **Frontend**: Single Page Application using modern, responsive vanilla HTML, CSS (Glassmorphism design, Light/Dark theme toggle), and Javascript.
- **Persistence**: File-based JSON database storage with daily automated backups.
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) (Data visualizations & trends)
  - [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) (PDF reports)
  - [Lucide Icons](https://lucide.dev/) (SVG Icons)

### File Directory

```
aura-track/
  ├── public/
  │   ├── index.html            # Webpage core SPA interface (Self-Mirror centerpiece layout)
  │   ├── css/
  │   │   └── style.css         # Styling system (Self-mirror glows, progress circle, mobile bottom drawers)
  │   └── js/
  │       └── app.js            # Client UI controllers, self-mirror thresholds engine, and PDF layout
  ├── server.js                 # Express API router & local static file server
  ├── package.json              # Node project configuration and script run instructions
  ├── .gitignore                # Excludes runtime dependencies, local logs, and OS files
  └── README.md                 # System design & architecture guide (this file)
```

---

## Data Schema Reference

### `data/config.json`
Stores the daily credit target goals and dynamic category configurations.
```json
{
  "targetCredits": 20,
  "frames": [
    {
      "id": "tahajjud_fajr",
      "label": "Tahajjud to Fajr",
      "maxCredits": 2,
      "habits": [
        "Wake for Tahajjud",
        "Qiyam / night prayer",
        "Dua and istighfar"
      ]
    },
    {
      "id": "fajr_pre_college",
      "label": "Fajr to Pre-College",
      "maxCredits": 6,
      "habits": [
        "Pray Fajr on time",
        "Morning adhkar",
        "Quran recitation"
      ]
    },
    ...
  ]
}
```

### `data/evaluations.json`
Stores saved evaluations sorted descending by date.
```json
[
  {
    "date": "2026-05-28",
    "scores": {
      "tahajjud_fajr": 8.0,
      "fajr_pre_college": 7.5,
      "college_zuhr": 6.0,
      "zuhr_asr": 8.5,
      "asr_maghrib": 7.0,
      "maghrib_isha": 8.0,
      "isha_tahajjud": 6.5
    },
    "habits": {
      "tahajjud_fajr": ["Wake for Tahajjud", "Dua and istighfar"],
      "fajr_pre_college": ["Pray Fajr on time"],
      "college_zuhr": [],
      "zuhr_asr": ["Pray Zuhr on time"],
      "asr_maghrib": [],
      "maghrib_isha": [],
      "isha_tahajjud": []
    },
    "mood": 4,
    "notes": "Protected the prayer windows and completed focused worship/work blocks."
  }
]
```

---

## API Documentation

The server hosts the following RESTful endpoints under `/api`:

### Configuration API
* **`GET /api/config`**
  Returns the current custom categories, target goals, and habit items.
* **`POST /api/config`**
  Updates the settings configuration object. Returns updated details.

### Evaluations API
* **`GET /api/evaluations`**
  Returns the list of historical evaluations sorted descending by date.
* **`GET /api/evaluations/:date`**
  Returns a single evaluation for the specified date string (`YYYY-MM-DD`). Returns `404` if not found.
* **`POST /api/evaluations`**
  Saves or updates a daily log. Cleans/clamps values and creates a file backup of the database in `data/backups` before saving.
* **`DELETE /api/evaluations/:date`**
  Deletes the daily entry for the specified date.
* **`POST /api/import`**
  Accepts a JSON array of evaluations and merges them into the database, overwriting entries on date duplicates.

---

## Running the Application

### 1. Installation
Install the necessary npm modules from the project root:
```bash
npm install
```

### 2. Run Options

- **Production / Standard Mode**:
  Starts the node process on port 3000:
  ```bash
  npm start
  ```
- **Development / Watch Mode**:
  Starts the process with Node's built-in file watcher. The backend will automatically restart upon edits:
  ```bash
  npm run dev
  ```

Once running, navigate to **`http://localhost:3000`** in your browser.

---

## Local Fallback & Offline Mode

AuraTrack is designed to work even if the backend server is temporarily shut down:
- The frontend client checks connection status and automatically switches to **Offline Mode** if the server endpoints are unreachable.
- Offline data is saved to, loaded from, and merged in browser **LocalStorage**.
- A status badge shows "Offline (Local)" in red when offline, and "Connected" in green when synced with the node backend database.

## PWA Install Experience

AuraTrack includes a modern Progressive Web App install flow:
- The manifest and service worker make the app installable and offline-ready.
- Supported browsers fire the native `beforeinstallprompt` event, and AuraTrack shows a polished in-app install prompt that opens the browser's real install dialog.
- iOS/iPadOS browsers do not expose the same native install prompt, so AuraTrack displays a guided fallback explaining the Share → Add to Home Screen path.
