# ResolveAI — AI-assisted L1 Support (Gmail + engineer review)

This local prototype imports unread messages from a Gmail inbox when an engineer clicks **Sync Gmail**. It creates tickets and produces an advisory diagnosis/draft reply. **It does not send email automatically.** The engineer must open the ticket, review/edit the draft, and explicitly click **Send reply via Gmail**.

## Requirements
- Python 3.10+
- VS Code (optional)
- A Google account and Google Cloud OAuth desktop credentials for Gmail integration
- Optional OpenAI API key for LLM-based issue analysis; otherwise a local rule-based analyzer is used

## Run on Windows
Open PowerShell in the folder that contains `main.py`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

If `.venv` already exists and is activated, **do not create it again**. Continue with package installation. Open `http://127.0.0.1:8000`.

## Configure Gmail OAuth (one-time)
1. Open Google Cloud Console: https://console.cloud.google.com/ and create/select a project.
2. In **APIs & Services → Library**, enable **Gmail API**.
3. In **Google Auth Platform** (or **APIs & Services → OAuth consent screen**), configure the app. For a personal prototype, choose External if required, complete the basic app details, and add the Gmail account you will test with under **Test users** while the app is in Testing.
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**. Choose **Desktop app** and create it.
5. Download the OAuth client JSON. Rename it exactly `credentials.json` and place it beside `main.py` in the `l1_support_ai` folder. Do not share this file or commit it to Git.
6. Restart the FastAPI server, then click **Sync Gmail** in the dashboard. A browser window opens for Google sign-in and consent. Sign in to the dedicated/test mailbox and approve the requested Gmail read and send permissions.
7. The app saves `token.json` locally. Keep it private; it is ignored by `.gitignore`. To revoke access, remove the app's access in your Google Account security settings and delete `token.json`.

Google OAuth screens can change slightly. Gmail scopes may be sensitive/restricted for public distribution; this desktop prototype is intended for personal testing, not a deployed multi-user service.

## Gmail behavior and safeguards
- Sync is manual: the app only checks when the engineer clicks **Sync Gmail**; there is no background polling.
- It imports up to 25 unread messages in the Inbox per sync and avoids importing the same Gmail message twice.
- Sync does not mark messages as read and does not send any response.
- Replies can only be sent by opening a ticket, reviewing/editing the draft, and clicking **Send reply via Gmail**, then confirming the prompt.
- The send endpoint is not protected by user login in this prototype. Keep the app on your own computer (`127.0.0.1`) and do not expose it publicly until authentication and role-based access control are implemented.
- Do not use real sensitive company data until you have permission and security controls. Never email passwords, MFA codes, or other secrets.

## Optional AI analysis
Set environment variables in the terminal before starting the server. PowerShell example:

```powershell
$env:OPENAI_API_KEY="your-api-key-here"
$env:OPENAI_MODEL="gpt-4.1-mini"
python -m uvicorn main:app --reload
```

If `OPENAI_API_KEY` is not set, local keyword rules classify the ticket. If an AI request fails, the app falls back to local rules. API usage may incur costs. Do not place API keys in frontend JavaScript or commit them to source control.

## Endpoints
- `GET /api/health`
- `GET /api/gmail/status`
- `POST /api/gmail/sync`
- `GET /api/tickets?q=VPN`
- `POST /api/tickets`
- `PATCH /api/tickets/{id}`
- `POST /api/tickets/{id}/reply`
- `GET /docs`

## Known limitations
This is a local proof of concept. It does not verify root cause against live company systems, execute remote fixes, monitor email in the background, provide multi-user authentication, or guarantee the email body parser handles every unusual message format. Use engineer review for all diagnoses and replies.
