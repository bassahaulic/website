# Bassahaulic Productions - Command Reference

## Getting Started

```bash
git clone https://github.com/bassahaulic/website.git
```
Clone the repository to your machine for the first time.

```bash
cd website
```
Enter the project folder.

```bash
git checkout claude/rebuild-website-OMyLb
```
Switch to the active development branch.

---

## Staying Up To Date

```bash
git pull origin claude/rebuild-website-OMyLb
```
Download the latest changes from GitHub to your local folder.

---

## Building & Previewing

```bash
npm run build
```
Assembles all pages — injects header, footer, nav, fonts, and matrix rain into every page. Outputs finished HTML to the `dist/` folder.

```bash
npm run dev
```
Builds the site AND starts a local web server at `http://localhost:3000` with live reload. Any file changes auto-refresh the browser. Press `Ctrl+C` to stop.

```bash
npm run clean
```
Deletes the `dist/` folder. Useful if you want a fresh build.

---

## Deploying to Firebase (Live Site)

```bash
npm run deploy
```
Builds the site then uploads `dist/` to Firebase. Your changes go live at `bassahaulic-website-2.web.app`.

```bash
npm run deploy:preview
```
Builds and deploys to a temporary preview URL (not your main site). Good for sharing with beta testers without affecting production.

```bash
firebase deploy
```
Uploads `dist/` to Firebase WITHOUT rebuilding first. Only use this if you already ran `npm run build`.

---

## Firebase Setup (One-Time)

```bash
npm install -g firebase-tools
```
Installs the Firebase CLI globally on your machine. Only needed once.

```bash
firebase login
```
Opens a browser to log in with your Google account. Only needed once per machine.

```bash
firebase use bassahaulic-website-2
```
Links this project folder to your Firebase project. Only needed once per machine.

---

## Git Basics

```bash
git status
```
Shows which files have been changed, added, or deleted since the last commit.

```bash
git add .
```
Stages ALL changed files for the next commit.

```bash
git add path/to/file.html
```
Stages a specific file for the next commit.

```bash
git commit -m "Description of what you changed"
```
Saves your staged changes as a commit with a message.

```bash
git push origin claude/rebuild-website-OMyLb
```
Uploads your commits to GitHub so they're available everywhere.

```bash
git log --oneline -10
```
Shows the last 10 commits as a quick summary.

```bash
git diff
```
Shows exactly what lines changed in your modified files.

---

## Creating a New Page

1. Create a folder under `src/pages/`:
   ```bash
   mkdir src/pages/my-new-page
   ```

2. Copy a template into it:
   ```bash
   cp src/templates/basic-page.html src/pages/my-new-page/index.html
   ```

3. Edit the file with your content, then build:
   ```bash
   npm run build
   ```

Your page is now available at `/my-new-page/`.

---

## Useful Checks

```bash
node --version
```
Check which version of Node.js is installed. Needs to be 18 or higher.

```bash
git --version
```
Check that Git is installed.

```bash
firebase --version
```
Check that the Firebase CLI is installed.
