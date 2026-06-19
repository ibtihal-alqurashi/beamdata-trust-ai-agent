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
| `GROQ_API_KEY` | Your Groq API key for language model execution |
| `AIRTABLE_PAT` | Your Airtable Personal Access Token (PAT) for database integration |
| `AIRTABLE_BASE_ID` | Your Airtable Base ID |
| `AIRTABLE_TABLE_NAME` | Your Airtable Table Name |
| `HF_TOKEN` | Hugging Face token required for sentence-transformers |

---

## 4. Finalize & Open Service

1. Once the environment variables are configured, click **Deploy Web Service** (or let Render auto-deploy if the build starts automatically).
2. Render will build the environment, install the packages in `requirements.txt`, run the initialization of the Beamdata Intelligent Agent, and launch Gunicorn.
3. Once the logs show a successful startup, copy the public URL provided by Render (e.g., `https://beamdata-trust-ai-agent.onrender.com`) and open it in your browser.
