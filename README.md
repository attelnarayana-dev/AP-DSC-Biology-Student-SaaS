# AP DSC Biology Student SaaS – Day 7 to 20

## Student flow
Create Account → Login → Dashboard → Select Day 7–20 → Start/Continue Exam → Submit → Result → Explanations.

## Important: NetworkError fix
This build has a **local/offline fallback**. If the project is opened directly as `index.html`, or the local Node server is not running, registration/login/progress automatically use browser local storage instead of failing with `NetworkError`.

### Simplest way
Open `index.html` directly in Firefox/Chrome and create the student account. No Internet and no credits are required.

### Optional server mode
For server-backed storage, double-click `start.command` on Mac (Node.js required). It opens `http://127.0.0.1:3000` and uses `db.json`.

## Student data
- Local/offline mode: saved in the browser's localStorage.
- Server mode: saved in `db.json` on the machine running the server.
- This package is not yet a public cloud deployment. For multiple students using different devices with shared accounts/results, deploy the backend with a production database and HTTPS.
