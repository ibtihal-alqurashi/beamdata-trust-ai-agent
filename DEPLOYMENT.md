# Beamdata Trust AI Agent - Deployment Guide

This guide explains how to prepare, upload, and deploy the Beamdata Intelligent Sales Assistant Flask project to GitHub and Render.

---

## 1. Push Code to GitHub

Ensure that your local files are committed and pushed to your GitHub repository:
1. Initialize git (if not already done):
   ```bash
   git init
   ```
2. Add a remote origin pointing to your repository name (`beamdata-trust-ai-agent`):
   ```bash
   git remote add origin https://github.com/<your-username>/beamdata-trust-ai-agent.git
   ```
3. Commit and push:
   ```bash
   git add .
   ```
   *(Note: Sensistive files like `.env`, local vectorstores, `venv/`, and `security_log.txt` are excluded automatically via `.gitignore`.)*
   ```bash
   git commit -m "chore: prepare for Render deployment"
   git branch -M main
   git push -u origin main
   ```

---

## 2. Deploy to Render

Render is a cloud platform that allows hosting web applications. To host this Flask project:

1. Sign in to [Render](https://render.com/).
2. Click **New +** in the top-right corner and select **Web Service**.
3. Connect your GitHub account and select your repository: **`beamdata-trust-ai-agent`**.
4. Configure the Web Service settings:
   - **Name**: `beamdata-trust-ai-agent` (or your preferred name)
   - **Region**: Select a region close to your target audience (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Runtime**: `Python`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     gunicorn project.app:app
     ```
   - **Instance Type**: Select your preferred tier (e.g., Free or Starter)

---

## 3. Configure Environment Variables

Do **not** upload your `.env` file to GitHub. Instead, configure the following environment variables directly in Render under the **Environment** tab:

| Variable Name | Description |
| :--- | :--- |
| `PYTHON_VERSION` | Set to `3.11.9` |
| `RENDER_LIGHT_MODE` | Set to `true` (enables lightweight mock vectorstore & bypasses heavy models) |
| `GROQ_API_KEY` | Your Groq API key for language model execution |
| `AIRTABLE_PAT` | Your Airtable Personal Access Token (PAT) for database integration |
| `AIRTABLE_BASE_ID` | Your Airtable Base ID |
| `AIRTABLE_TABLE_NAME` | Your Airtable Table Name |

---

## 4. Finalize & Open Service

1. Once the environment variables are configured, click **Deploy Web Service** (or let Render auto-deploy if the build starts automatically).
2. Render will build the environment, install the packages in `requirements.txt`, run the initialization of the Beamdata Intelligent Agent, and launch Gunicorn.
3. Once the logs show a successful startup, copy the public URL provided by Render (e.g., `https://beamdata-trust-ai-agent.onrender.com`) and open it in your browser.

---

> [!NOTE]
> **Render Free Plan Cold Starts**
> When deployed on Render's Free tier, the web service will automatically spin down after 15 minutes of inactivity. When a new request arrives, Render will spin the container back up. This "cold start" process can take up to a minute or more, during which visitors might experience a loading delay. 
> To mitigate this, a professional brand loading screen is built into the application to indicate that the service is initializing and prevent a blank or black screen experience on first load.
>
> **Important Clarification on Loading Screens:**
> - **Render's Cold-Start Loader:** Render may display its own default loading or progress screen while spinning up the container. This happens *before* the Flask application starts or receives any requests.
> - **App-Level Loading Screen:** The custom Beamdata brand loading screen will only appear *after* the Flask app is awake and has begun serving the frontend.
> - **Behavior:** The Render cold-start screen cannot be replaced or bypassed by the Flask app loader, as the application process itself is not yet running during the initial cold start.

