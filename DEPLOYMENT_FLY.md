Fly.io deployment notes
=======================

Steps to deploy this project to Fly.io (manual prep required):

1. Create a Fly account and install `flyctl` locally:

   ```bash
   curl -L https://fly.io/install.sh | sh
   export PATH="$HOME/.fly/bin:$PATH"
   flyctl auth login
   ```

2. Create two Fly apps (backend and frontend) and a Postgres DB:

   ```bash
   flyctl apps create my-eduadmit-backend --region sin
   flyctl apps create my-eduadmit-frontend --region sin

   # Create a managed Postgres instance
   flyctl postgres create --name eduadmit-db --region sin
   ```

3. Create a persistent volume for uploads (optional but recommended):

   ```bash
   flyctl volumes create uploads --size 1 --region sin
   ```

4. Set required secrets (use values from your Postgres instance and chosen JWT secret):

   ```bash
   flyctl secrets set DATABASE_URL="postgres://user:pass@host:5432/dbname" JWT_SECRET="<your-secret>"
   ```

5. Deploy from your machine (or push to GitHub and use the provided GitHub Actions workflow):

   ```bash
   # From repo root: deploy backend
   cd backend
   flyctl deploy --app <BACKEND_APP_NAME>

   # Deploy frontend
   cd ../frontend
   flyctl deploy --app <FRONTEND_APP_NAME>
   ```

6. GitHub Actions

   - The workflow `.github/workflows/deploy-fly.yml` will deploy both apps on push to `main`.
   - Required repository secrets:
     - `FLY_API_TOKEN` (Personal API token from Fly)
     - `FLY_APP_NAME_BACKEND` (the backend app name)
     - `FLY_APP_NAME_FRONTEND` (the frontend app name)

Notes
-----
- The workflow uses `--remote-only` deploys (build happens on Fly's builders). If you want to build locally and push, modify the workflow accordingly.
- Ensure `backend/fly.toml` and `frontend/fly.toml` have the correct `app` fields or set the secrets above and they will be used at deploy time.
