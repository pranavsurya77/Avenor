# Setup & Deployment

This guide covers setting up **Avenor** in a local development environment and deploying it to production hosting platforms like **Render**.

---

## 1. Local Environment Setup

### Prerequisites
* **Node.js** (v18 or higher)
* **Git** installed on the local system
* **Redis** (running locally or a remote connection string)
* **PostgreSQL** database instance

### Environment Variables (`.env`)
Create a `.env` file in the root directory:
```ini
# GitHub App Configuration
APP_ID=123456
CLIENT_ID=Iv23...
CLIENT_SECRET=44bd4...
GITHUB_PAT=ghp_...

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/mydb?schema=public"

# Redis Config
# REDIS_HOST=127.0.0.1  (defaults to localhost:6379 if omitted)

# JWT Secret Secrets
ACCESS_TOKEN_SECRET=yoursecretkey
REFRESH_TOKEN_SECRET=yourrefreshsecretkey

# AI Configuration (OpenRouter)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-v4-flash
MAX_ITERATIONS=10
```

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Generate Prisma Client and apply migrations:
   ```bash
   npx prisma generate
   npx prisma db push
   ```
3. Compile and run the development server:
   ```bash
   npm run dev
   ```

---

## 2. Production Deployment (Render)

Avenor can be easily deployed to **Render** using a persistent disk and environment variables.

### Recommended Render Services Setup
Because Avenor needs a persistent disk to host the local cloned repositories, you should run the web server and the BullMQ worker in a **single Render Web Service instance** (to keep files shared on the same disk) or scale using **Background Workers**.

#### Option A: Combined Web & Worker Instance
1. Create a **Web Service** on Render.
2. Select your repository.
3. Configure the environment variables to match your `.env` values.
4. **Attach a Persistent Disk**:
   * Add a Disk to the Web Service.
   * Set **Mount Path** to `/workspace` (Avenor will clone repositories here).
   * Size: `10GB` (or higher depending on target repository sizes).
5. Add a **Redis Instance** on Render and copy its connection string to your environment settings.
6. Add a **PostgreSQL Database** on Render and update `DATABASE_URL`.
7. Start Command: `npm run start` (which runs `tsc` and starts the app, initializing the worker).

---

## 3. GitHub App Configuration

For Avenor to automate tasks in your repositories, you must register a **GitHub App**:

1. Go to **Settings > Developer Settings > GitHub Apps > New GitHub App**.
2. **Permissions**:
   * **Repository Permissions**:
     * `Issues`: Read & Write (to retrieve issues, post comments, and close them).
     * `Contents`: Read & Write (to clone, create branches, and push code).
     * `Pull Requests`: Read & Write (to raise pull requests).
3. **Webhooks**:
   * Enable Webhooks and set the URL to `https://your-render-domain.com/webhooks`.
   * Under **Subscribe to events**, select **Issues**.
4. Generate a **Private Key** (.pem) and save it in your project folder, setting the `PRIVATE_KEY_PATH` in `.env` to match its name.
5. Install the GitHub App on your target repositories.
