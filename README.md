# AuraTrack Architecture & Development Context

AuraTrack is a daily self-evaluation and habit-tracking dashboard designed for high-agency individuals. It uses a structured three-timeframe credit allocation model (maximum 25 credits per day) with customizable habits, daily checklists, mood ratings, and text reflections.

---

## Technical Stack & Layout

The project is structured as a full-stack JavaScript application:

- **Backend**: Node.js & Express server.
- **Frontend**: Single Page Application using modern, responsive vanilla HTML, CSS (Glassmorphism design, Light/Dark theme toggle), and Javascript.
- **Persistence**: File-based JSON database storage with daily automated backups.
- **Libraries**:
  - [Chart.js](https://www.chartjs.org/) (Data visualizations & trends)
  - [jsPDF](https://github.com/parallax/jsPDF) & [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) (PDF reports)
  - [Lucide Icons](https://lucide.dev/) (SVG Icons)

### File Directory

```
d:\discipline-tracker\
  ├── data\
  │   ├── evaluations.json      # Saved daily logs (array of evaluations)
  │   ├── config.json           # User configuration (daily target, timeframe configurations, habit items)
  │   └── backups\              # Automatically rotated database backups (keeps last 15 saves)
  ├── public\
  │   ├── index.html            # Webpage core SPA interface
  │   ├── css\
  │   │   └── style.css         # Styling system (variables, custom sliders, animations, dark theme)
  │   └── js\
  │       └── app.js            # Client UI controllers, API client, charts rendering, and PDF layout
  ├── server.js                 # Express API router & local static file server
  ├── package.json              # Node project configuration and script run instructions
  └── context.md                # System design & architecture guide (this file)
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
      "id": "pre",
      "label": "Pre-College",
      "maxCredits": 8,
      "habits": [
        "Wake up on time",
        "Morning exercise",
        "Healthy breakfast"
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
      "pre": 8.0,
      "college": 7.5,
      "post": 6.0
    },
    "habits": {
      "pre": ["Wake up on time", "Morning exercise"],
      "college": ["Attend all classes"],
      "post": []
    },
    "mood": 4,
    "notes": "Finished morning workout and studied for midterm."
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
