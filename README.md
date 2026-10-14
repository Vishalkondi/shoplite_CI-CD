![Uploading Screenshot 2026-10-13 172405.png…]()
# ShopLite — learn CI/CD & DevOps with a real e-commerce app

ShopLite is a small but complete online store: browse products, filter and search, add items to a
cart and place an order. It is built to practise the everyday skills of a full-stack / DevOps engineer:
**React, REST APIs, PostgreSQL, Docker, automated tests and GitHub Actions CI**.

> 💸 Nothing here deploys to a cloud provider or costs money. GitHub Actions runs on GitHub's free
> runners (free for public repositories, and within the monthly free minutes for private ones).
> There is no real payment processing: placing an order only saves it in the database.

---

## Contents

1. [Project overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Technology stack](#3-technology-stack)
4. [Folder structure](#4-folder-structure)
5. [Prerequisites](#5-prerequisites)
6. [Docker Desktop setup](#6-docker-desktop-setup)
7. [PowerShell basics for this project](#7-powershell-basics-for-this-project)
8. [Environment file setup](#8-environment-file-setup)
9. [Running the application](#9-running-the-application)
10. [API reference and request examples](#10-api-reference-and-request-examples)
11. [Testing](#11-testing)
12. [Database integration test setup](#12-database-integration-test-setup)
13. [Git and GitHub setup](#13-git-and-github-setup)
14. [The GitHub Actions pipeline explained](#14-the-github-actions-pipeline-explained)
15. [Docker commands and log inspection](#15-docker-commands-and-log-inspection)
16. [Stopping and restarting services](#16-stopping-and-restarting-services)
17. [Safe cleanup](#17-safe-cleanup)
18. [Common errors and solutions](#18-common-errors-and-solutions)
19. [Security notes](#19-security-notes)
20. [Suggested next learning steps](#20-suggested-next-learning-steps)

---

## 1. Project overview

| Feature | Where |
|---------|-------|
| Homepage with hero banner, navigation, product grid with images, category and stock | `frontend/src/App.jsx`, `components/` |
| Category filter and search | `frontend/src/App.jsx` |
| Cart with quantity controls, remove, live total, saved in `localStorage` | `frontend/src/hooks/useCart.js`, `components/Cart.jsx` |
| Checkout form (name + email) and confirmation page with the order ID | `components/Checkout.jsx`, `components/Confirmation.jsx` |
| Loading skeletons, empty states, readable error messages with retry | `frontend/src/App.jsx` |
| REST API: health, products, orders | `backend/src/routes/` |
| Orders are saved in a **database transaction**: stock is checked and reduced atomically, nothing is saved if any item fails, and concurrent buyers can't oversell | `backend/src/repositories/orderRepository.js` |
| 3 containers (db, backend, frontend) started with one command | `compose.yaml` |
| 76 automated tests with coverage thresholds | `backend/tests/` |
| CI pipeline: tests → build → Docker smoke test | `.github/workflows/ci.yml` |

## 2. Architecture

```
                      Your browser
                           │
                           ▼
      ┌──────────────── http://localhost:3000 ─────────────────┐
      │  frontend container  (nginx)                           │
      │    /              → React app (static files)           │
      │    /images/*      → product images                     │
      │    /api/*         → forwarded to http://backend:5000   │
      └───────────────────────────┬────────────────────────────┘
                                  │  private Docker network
                                  ▼        (service names = hostnames)
      ┌──────────────── http://localhost:5000 ─────────────────┐
      │  backend container  (Node.js 22 + Express 5)           │
      │    routes → services (business rules) → repositories   │
      └───────────────────────────┬────────────────────────────┘
                                  │  SQL to db:5432
                                  ▼
      ┌──────────────── localhost:5433 (for DB tools) ─────────┐
      │  db container  (PostgreSQL 16)                         │
      │    data lives in the named volume "shoplite_db-data"   │
      └────────────────────────────────────────────────────────┘
```

Key ideas:

- Containers talk to each other by **service name** (`backend`, `db`), never `localhost`. Inside a
  container, `localhost` means "this same container".
- The browser only ever talks to nginx on port 3000. nginx forwards `/api` calls to the backend,
  so there are no CORS problems.
- Port `5000` (API) and `5433` (database) are also published to your PC so you can test and inspect
  them directly.

## 3. Technology stack

| Layer | Technology | Why |
|-------|------------|-----|
| Frontend | React 19, Vite 8, JavaScript | Component-based UI; Vite gives a fast dev server and an optimised production build |
| Web server | nginx 1.27 | Serves the built files and proxies `/api` to the backend |
| Backend | Node.js 22, Express 5 | Express 5 forwards errors thrown in `async` routes to the error handler automatically |
| Database | PostgreSQL 16 + `pg` driver | Transactions, constraints, exact `NUMERIC` money type |
| Tests | Jest 30, Supertest 7 | Unit tests + real HTTP requests against the Express app |
| Containers | Docker, Docker Compose | Same environment on every machine and in CI |
| CI | GitHub Actions | Runs everything automatically on every push |

Exact dependency versions are locked in `backend/package-lock.json` and `frontend/package-lock.json`.
`npm ci` installs exactly those versions, so your PC, Docker and CI all use identical packages.

## 4. Folder structure

```
F:\Full Stack Developer\
├── compose.yaml                  # Defines the 3 services, volume, health checks, ports
├── .env.example                  # Template for .env (copy it; .env is never committed)
├── .gitignore                    # Keeps .env, node_modules, build output out of Git
├── README.md
├── .github/workflows/ci.yml      # The CI pipeline
├── backend/
│   ├── Dockerfile                # Node 22 Alpine image, runs as non-root user
│   ├── .dockerignore             # Files Docker must not copy into the image
│   ├── .env.example              # Settings for running the API without Docker
│   ├── jest.config.js            # Test + coverage threshold settings
│   ├── db/init.sql               # Tables, constraints, indexes, 12 sample products
│   ├── scripts/ci-test-summary.js# Writes the test table on the GitHub run page
│   ├── src/
│   │   ├── server.js             # Entry point: DB pool, HTTP server, graceful shutdown
│   │   ├── app.js                # Builds the Express app (shared by server and tests)
│   │   ├── config.js             # Reads environment variables
│   │   ├── db.js                 # Connection pool + transaction helper
│   │   ├── errors.js             # AppError + "is the database down?" detection
│   │   ├── routes/               # health.js, products.js, orders.js, params.js
│   │   ├── services/             # orderService.js: validation, totals, stock rules (pure)
│   │   ├── repositories/         # productRepository.js, orderRepository.js: all SQL
│   │   ├── middleware/           # errorHandler.js, requestLogger.js
│   │   └── scripts/initDb.js     # `npm run db:init` applies init.sql
│   └── tests/
│       ├── unit/                 # orderService.test.js, errors.test.js
│       └── integration/          # api.test.js (mocked DB), database.test.js (real DB)
└── frontend/
    ├── Dockerfile                # Stage 1: build with Node. Stage 2: serve with nginx
    ├── .dockerignore
    ├── nginx.conf                # SPA fallback, /api proxy, caching, security headers
    ├── index.html
    ├── vite.config.js            # Dev server proxies /api → localhost:5000
    ├── public/images/products/   # 12 product images (SVG)
    └── src/
        ├── main.jsx, App.jsx, styles.css, format.js
        ├── api/client.js         # Reusable fetch wrapper with error handling
        ├── hooks/useCart.js      # Cart state + localStorage persistence
        └── components/           # Header, ProductList, ProductCard, ProductImage,
                                  # Cart, QuantityControl, Checkout, Confirmation
```

## 5. Prerequisites

| Tool | Download | Check it works (PowerShell) |
|------|----------|------------------------------|
| Docker Desktop | https://www.docker.com/products/docker-desktop/ | `docker --version` and `docker compose version` |
| Node.js 22 LTS (or newer) | https://nodejs.org/ | `node -v` (must be v20.19+ or v22.12+) and `npm -v` |
| Git | https://git-scm.com/download/win | `git --version` |
| VS Code (optional) | https://code.visualstudio.com/ | — |

```powershell
docker --version          # prints the Docker CLI version, e.g. "Docker version 29.x"
docker compose version    # prints the Compose plugin version, e.g. "v5.x"
node -v                   # prints the Node.js version
git --version             # prints the Git version
```

If a command is "not recognized", close and reopen PowerShell (PATH changes only apply to new windows).

## 6. Docker Desktop setup

1. Install Docker Desktop and accept the default **WSL 2** backend when asked.
2. Restart Windows if the installer requests it.
3. Start **Docker Desktop** from the Start menu. Wait until the bottom-left status says
   **Engine running** (the whale icon in the system tray stops animating).
4. Verify from PowerShell:

   ```powershell
   docker run --rm hello-world   # downloads a tiny test image and runs it once
   ```

   You should see "Hello from Docker!". `--rm` removes the test container afterwards.

> Docker Desktop must be running whenever you use `docker` commands. If you see
> `failed to connect to the docker API ... dockerDesktopLinuxEngine`, it isn't running.

## 7. PowerShell basics for this project

| Command | What it does |
|---------|--------------|
| `cd "F:\Full Stack Developer"` | Go to the project folder (quotes are needed because of the spaces) |
| `Copy-Item a b` | Copy file `a` to `b` |
| `notepad .env` | Open a file in Notepad |
| `$env:NAME = "value"` | Set an environment variable for this PowerShell window only |
| `Remove-Item Env:NAME` | Unset that environment variable |
| `Invoke-RestMethod <url>` | Call an API and show the JSON as a PowerShell object |
| `curl.exe <url>` | Real curl (plain `curl` is an alias for a different PowerShell command) |
| `` ` `` (backtick) at end of line | Continue a long command on the next line |

## 8. Environment file setup

Settings such as passwords are read from **environment variables**, never hard-coded.
Docker Compose reads them from a file named `.env` next to `compose.yaml`.

```powershell
cd "F:\Full Stack Developer"
Copy-Item .env.example .env   # create your own copy of the template (only once)
notepad .env                  # change POSTGRES_PASSWORD to a password of your choice, save
```

`.env` contents:

| Variable | Default | Meaning |
|----------|---------|---------|
| `POSTGRES_USER` | `shop` | Database user |
| `POSTGRES_PASSWORD` | *(you choose)* | Database password. **Required**: Compose refuses to start without it |
| `POSTGRES_DB` | `shop` | Database name |
| `DB_HOST_PORT` | `5433` | Port on your PC for database tools (5433 avoids clashing with a local PostgreSQL on 5432) |
| `BACKEND_PORT` | `5000` | Port on your PC for the API |
| `FRONTEND_PORT` | `3000` | Port on your PC for the store |

`.env` is listed in `.gitignore`, so Git never commits it. Only `.env.example` (with a placeholder
password) is committed.

> ⚠️ PostgreSQL only uses `POSTGRES_PASSWORD` the **first time** the database volume is created.
> Changing it later causes "password authentication failed". See [section 18](#18-common-errors-and-solutions).

## 9. Running the application

### Option A — everything in Docker (recommended)

```powershell
cd "F:\Full Stack Developer"
docker compose up --build -d
```

- `up` creates and starts the containers defined in `compose.yaml`
- `--build` (re)builds the backend and frontend images from their Dockerfiles first
- `-d` ("detached") runs them in the background and gives you your prompt back

The first build downloads base images and takes a few minutes. Then check the status:

```powershell
docker compose ps
```

Wait until all three services show **(healthy)**. Startup order is automatic: the backend waits for
a healthy database, and the frontend waits for a healthy backend.

Open these URLs:

| What | URL |
|------|-----|
| 🛍️ Store | http://localhost:3000 |
| API liveness | http://localhost:5000/api/health |
| API readiness (checks the DB) | http://localhost:5000/api/health/ready |
| Products API | http://localhost:5000/api/products |

Connect a database tool (pgAdmin, DBeaver, a VS Code extension) to host `localhost`, port `5433`,
database `shop`, user `shop`, and the password from your `.env`.

### Option B — run the code on your PC with hot reload (for development)

The database still runs in Docker; the backend and frontend run with Node so code edits apply instantly.

```powershell
# Terminal 1: start only the database container
docker compose up -d db

# Terminal 2: the API on http://localhost:5000
cd "F:\Full Stack Developer\backend"
npm install                  # install dependencies (first time only)
Copy-Item .env.example .env  # first time only
notepad .env                 # set DB_PASSWORD = the POSTGRES_PASSWORD from the root .env
npm run dev:env              # starts the API, restarts it whenever you save a file in src/

# Terminal 3: the store on http://localhost:5173
cd "F:\Full Stack Developer\frontend"
npm install
npm run dev                  # Vite dev server; forwards /api/* to localhost:5000
```

> Stop the Docker `backend` and `frontend` containers first (`docker compose stop backend frontend`)
> if they are running, otherwise port 5000 is already taken.

Using a PostgreSQL installed directly on Windows instead? Create a database, point `backend\.env`
at it, then run `npm run db:init` in `backend` to create the tables and sample data.

## 10. API reference and request examples

| Method | Endpoint | Purpose | Success | Errors |
|--------|----------|---------|---------|--------|
| GET | `/api/health` | Liveness: is the API process running? | 200 | — |
| GET | `/api/health/ready` | Readiness: can the API reach the database? | 200 | 503 |
| GET | `/api/products` | List all products | 200 | 503 |
| GET | `/api/products?category=Books` | Products in one category | 200 | 400, 503 |
| GET | `/api/products/:id` | One product | 200 | 400, 404, 503 |
| POST | `/api/orders` | Place an order (reduces stock) | 201 | 400, 404, 409, 503 |
| GET | `/api/orders` | 50 most recent orders | 200 | 503 |
| GET | `/api/orders/:id` | One order with its items | 200 | 400, 404, 503 |

Status codes used: **400** invalid input or malformed JSON · **404** not found · **409** not enough
stock · **503** database unavailable · **500** unexpected bug (details are logged, never returned).

Every error response has the same shape:

```json
{ "error": "Insufficient stock", "details": ["Only 3 left of 'Yoga Mat'"] }
```

A product:

```json
{ "id": 7, "name": "Coffee Mug", "description": "Ceramic 350ml mug, dishwasher safe.", "price": 12.5,
  "icon": "☕", "imageUrl": "/images/products/coffee-mug.svg", "category": "Home", "stock": 100 }
```

Order request rules: `customerName` 2–100 characters; `customerEmail` a valid address; `items` a
non-empty list of `{ productId, quantity }` with quantity 1–99. Duplicate product lines are merged.

### PowerShell examples (`Invoke-RestMethod`)

```powershell
# Is the API alive? Is the database reachable?
Invoke-RestMethod http://localhost:5000/api/health
Invoke-RestMethod http://localhost:5000/api/health/ready

# All products, shown as a table
Invoke-RestMethod http://localhost:5000/api/products | Format-Table id, name, category, price, stock

# Filter by category, and fetch one product
Invoke-RestMethod "http://localhost:5000/api/products?category=Books"
Invoke-RestMethod http://localhost:5000/api/products/1

# Place an order: build a PowerShell object, convert it to JSON, POST it
$order = @{
  customerName  = "Ada Lovelace"
  customerEmail = "ada@example.com"
  items         = @(@{ productId = 7; quantity = 2 }, @{ productId = 10; quantity = 1 })
} | ConvertTo-Json -Depth 5
$created = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/orders `
  -ContentType "application/json" -Body $order
$created                         # shows id, total, items...

# Read the order back, and list recent orders
Invoke-RestMethod "http://localhost:5000/api/orders/$($created.id)"
Invoke-RestMethod http://localhost:5000/api/orders

# See an error response. Invoke-RestMethod throws on 4xx/5xx, so catch it and print the body:
try {
  Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/orders `
    -ContentType "application/json" -Body '{"customerName":"","items":[]}'
} catch { $_.ErrorDetails.Message }
```

### curl examples

```powershell
curl.exe -i http://localhost:5000/api/products/7     # -i also shows the status line and headers
curl.exe -i http://localhost:3000/api/products/7     # same request, through the nginx proxy

curl.exe -i -X POST http://localhost:5000/api/orders -H "Content-Type: application/json" `
  --data-raw '{\"customerName\":\"Ada\",\"customerEmail\":\"ada@example.com\",\"items\":[{\"productId\":12,\"quantity\":5}]}'
# -> HTTP/1.1 409 Conflict  (there are only 3 Yoga Mats)
```

> The `\"` escaping is for **Windows PowerShell 5.1** (the built-in one). In **PowerShell 7.3+**
> remove the backslashes: `--data-raw '{"customerName":"Ada", ...}'`.

## 11. Testing

```powershell
cd "F:\Full Stack Developer\backend"
npm install                  # first time only

npm test                     # run every test once
npm run test:unit            # only the unit tests (fast, no database)
npm run test:integration     # only the integration tests
npm run test:coverage        # all tests + coverage report (open coverage\lcov-report\index.html)
```

| Suite | Needs PostgreSQL? | What it checks |
|-------|-------------------|----------------|
| `tests/unit/orderService.test.js` | No | Invalid name/email, invalid product IDs and quantities, empty orders, merging duplicate items, totals in exact cents (0.1 + 0.2 = 0.3), stock rules |
| `tests/unit/errors.test.js` | No | Which errors mean "database down" (→ 503) vs. a bug (→ 500) |
| `tests/integration/api.test.js` | No (repositories mocked with Jest) | Every endpoint via real HTTP: success, 400/404/409, malformed JSON, unknown routes, consistent error shape, database-unavailable → 503, no leaked internals, CORS, request logging |
| `tests/integration/database.test.js` | **Yes** | Schema + seed data, re-running `init.sql`, product lookup, order creation, stock reduction, merged duplicates, **rollback** of a failed order, **5 concurrent buyers vs. 3 items in stock**, unreachable DB → 503 |

**Expected results**

- Without a test database: `Tests: 11 skipped, 65 passed, 76 total`, plus a yellow
  `SKIPPED: PostgreSQL integration tests ... did NOT run` warning. **Skipped is not passed**: those
  11 tests didn't run.
- With a test database (section 12) and in CI: `Tests: 76 passed, 76 total`.

**Coverage thresholds** (in `backend/jest.config.js`): `npm run test:coverage` fails if coverage
falls below the limits. Services, routes, middleware and `errors.js` are always checked. The overall
threshold (85% lines) only applies when the database tests run, because the repositories can only be
tested against a real database.

**Frontend build check**

```powershell
cd "F:\Full Stack Developer\frontend"
npm run build      # creates the optimised production files in frontend\dist\
npm run preview    # serves dist\ at http://localhost:4173 to try the production build
```

## 12. Database integration test setup

The database tests **delete and recreate all tables** before every test. To protect your real data
they refuse to run unless the database name ends in `_test`. Running them against `shop` fails with
`Refusing to run destructive tests against database 'shop'`.

```powershell
cd "F:\Full Stack Developer"
docker compose up -d db      # make sure the database container is running

# Create a separate, disposable test database inside the same PostgreSQL (once):
docker compose exec db psql -U shop -d shop -c "CREATE DATABASE shop_test"

# Tell the tests where it is (this PowerShell window only).
# Replace YOUR_PASSWORD with POSTGRES_PASSWORD from .env:
$env:TEST_DATABASE_URL = "postgres://shop:YOUR_PASSWORD@localhost:5433/shop_test"

cd backend
npm run test:coverage        # now all 76 tests run
Remove-Item Env:TEST_DATABASE_URL   # unset when you're done
```

The `shop_test` database lives in the same Docker volume, so `docker compose down -v` deletes it too
(just create it again).

## 13. Git and GitHub setup

```powershell
cd "F:\Full Stack Developer"

# One-time Git identity (use your GitHub email)
git config --global user.name  "Your Name"
git config --global user.email "you@example.com"

git init -b main                  # turn the folder into a Git repository, branch "main"
git add .                         # stage all files (.gitignore excludes secrets & build output)
git status                        # CHECK: .env and node_modules must NOT be listed
git commit -m "Initial ShopLite app with CI"
```

Then on GitHub: **New repository** → name it `shoplite` → **don't** add a README, .gitignore or licence → Create.

```powershell
git remote add origin https://github.com/<your-username>/shoplite.git   # link to GitHub
git push -u origin main                                                 # upload; -u remembers the link
```

Day-to-day workflow with pull requests:

```powershell
git switch -c feature/better-search     # create and switch to a new branch
# ...edit code...
git add .
git commit -m "Improve product search"
git push -u origin feature/better-search
# On GitHub: open a Pull Request into main. CI runs on it automatically.
```

## 14. The GitHub Actions pipeline explained

File: `.github/workflows/ci.yml`. It runs on **push to `main`**, on **pull requests into `main`**, and
manually from **Actions → CI → Run workflow**.

```
 push / PR
    │
    ├─► backend   (≈1 min)  npm ci → 76 tests against a temporary PostgreSQL → coverage
    │
    ├─► frontend  (≈1 min)  npm ci → vite build → upload dist/
    │                    (these two run in parallel)
    └─► docker    (≈3 min)  only if BOTH succeeded:
                            compose config → build images → up --wait →
                            smoke tests → logs on failure → down (always)
```

| Job | Steps | Why it matters |
|-----|-------|----------------|
| **backend** | Starts a `postgres:16` *service container* with a `shop_test` database, runs `npm ci` and `npm run test:ci` | Proves the business logic, the API and the real SQL all work. `REQUIRE_TEST_DATABASE=true` makes the job **fail** if the DB tests would be skipped, so it can't go green without running them. A results table is written to the run's Summary page and the coverage report is uploaded as an artifact |
| **frontend** | `npm ci`, `npm run build`, uploads `dist/` | Proves the React app compiles |
| **docker** | Creates `.env` from the template with a random password, validates `compose.yaml`, builds images, starts the stack and waits for health checks, then calls `/api/health/ready`, lists products from the API and **through nginx**, loads the homepage and an SPA route, places a real order | Proves the containers work together exactly like on your PC. On failure it prints `docker compose ps` and all logs. It always runs `docker compose down --volumes` at the end |

Good-practice details in the file:

- `permissions: contents: read`: the workflow token can only read the code.
- Actions are pinned to a **commit SHA** (`actions/checkout@3d3c42e…  # v7.0.1`). Tags can be moved;
  SHAs can't, so the CI code can't change without a commit to this file.
- `timeout-minutes` on every job, so a hung job can't burn minutes for hours.
- `concurrency` cancels an outdated run when you push again to the same branch.
- `npm ci` with a cache keyed on `package-lock.json` gives fast, reproducible installs.

Viewing results on GitHub: **Actions** tab → click a run → click a job to see each step's log.
Artifacts (coverage, dist) are at the bottom of the run page.

**Try it:** break a test on purpose (e.g. in `tests/unit/orderService.test.js` change
`expect(total).toBe(0.3)` to `0.4`), commit and push, and watch the pipeline fail and the docker job get
skipped. Revert, push, and watch it go green. Then protect `main`: **Settings → Branches → Add branch
ruleset/rule → Require status checks to pass** and select the three CI jobs.

## 15. Docker commands and log inspection

```powershell
docker compose ps                     # status and health of each service
docker compose ps --all               # include stopped/crashed containers

docker compose logs                   # all logs from all services
docker compose logs -f backend        # follow (-f) the API log live; Ctrl+C stops watching, not the app
docker compose logs --tail 50 db      # only the last 50 lines from PostgreSQL
docker compose logs --since 10m       # everything from the last 10 minutes
docker compose logs -t frontend       # with timestamps (-t)
```

The backend writes one line per request, e.g. `POST /api/orders 201 9.2ms`, and logs errors with
`[error]`. nginx logs every request it serves.

Looking inside containers:

```powershell
docker compose exec backend sh              # open a shell inside the backend (type exit to leave)
docker compose exec db psql -U shop -d shop # SQL prompt inside the database
```

Useful `psql` commands:

```sql
\dt                                              -- list tables
SELECT id, name, stock FROM products;            -- current stock
SELECT * FROM orders ORDER BY id DESC LIMIT 5;   -- latest orders
SELECT * FROM order_items WHERE order_id = 1;    -- items of order 1
\q                                               -- quit
```

Other handy commands:

```powershell
docker stats                         # live CPU / memory per container (Ctrl+C to exit)
docker compose images                # images used by this project and their sizes
docker inspect --format "{{json .State.Health}}" shoplite-backend-1   # health-check history
docker compose config                # the final Compose config with .env values filled in
```

> ⚠️ `docker compose config` prints your real password from `.env`. Don't paste its output publicly.

## 16. Stopping and restarting services

```powershell
docker compose stop                  # stop all containers (they still exist; data is kept)
docker compose start                 # start them again
docker compose restart backend       # restart one service (e.g. after changing an env var)

docker compose down                  # stop AND remove containers + network. Data is KEPT (volume stays)
docker compose up -d                 # recreate and start again; your orders are still there

docker compose up --build -d         # rebuild images after changing code, then restart what changed
docker compose up --build -d backend # rebuild/restart only the backend
```

The backend handles `stop`/`restart` gracefully: it stops accepting new requests, finishes the ones in
progress and closes database connections before exiting (`[server] Closed cleanly` in the logs).

## 17. Safe cleanup

Commands get more destructive as you go down this table:

| Command | Removes | Your data |
|---------|---------|-----------|
| `docker compose stop` | Nothing (only stops) | ✅ Kept |
| `docker compose down` | This project's containers and network | ✅ Kept in the volume |
| `docker image prune` | Dangling (untagged, unused) images only | ✅ Kept |
| `docker builder prune` | Docker build cache | ✅ Kept (next build is slower) |
| **`docker compose down -v`** | Containers, network **and the database volume** | ❌ **DELETED** |

> 🛑 **`docker compose down -v` permanently deletes the `shoplite_db-data` volume: every order, all
> stock changes and the `shop_test` database.** The next `up` recreates the sample data from
> `init.sql`. Use it only when you *want* a fresh database (for example after editing `init.sql`, or
> after changing `POSTGRES_PASSWORD`). There is no undo.

Back up before resetting, if you want to keep your data:

```powershell
# Back up: dump inside the container, then copy the file to your PC
docker compose exec db pg_dump -U shop -d shop --clean --if-exists -f /tmp/backup.sql
docker compose cp db:/tmp/backup.sql .\backup.sql

# Restore later (replaces the current tables with the backup)
docker compose cp .\backup.sql db:/tmp/backup.sql
docker compose exec db psql -U shop -d shop -v ON_ERROR_STOP=1 -f /tmp/backup.sql
```

The file is created inside the container and then copied, rather than redirected with `>`,
because Windows PowerShell 5.1 would save it as UTF-16 and corrupt characters such as emoji.
`backup.sql` contains your data. Keep it out of Git and don't share it.

Avoid `docker system prune -a --volumes` unless you understand it: it removes **all** unused images
and volumes for **every** project on your PC, not just ShopLite.

## 18. Common errors and solutions

| Symptom | Cause and fix |
|---------|---------------|
| `required variable POSTGRES_PASSWORD is missing a value` | No `.env` file. Run `Copy-Item .env.example .env` and set a password. |
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop isn't running. Start it and wait for "Engine running". |
| `ports are not available ... 0.0.0.0:3000 ... Only one usage of each socket address` (or `port is already allocated`) | Another program is using that port. Find it: `Get-NetTCPConnection -LocalPort 3000 -State Listen \| Select OwningProcess` then `Get-Process -Id <number>`. Stop that program, **or** change the port in `.env` (e.g. `FRONTEND_PORT=3001`) and open http://localhost:3001 instead. |
| Backend restarts repeatedly; logs show `password authentication failed for user "shop"` | `POSTGRES_PASSWORD` changed after the volume was created. Put the old password back, **or** reset with `docker compose down -v` (⚠️ deletes data) then `docker compose up -d`. |
| Edits to `init.sql` have no effect | `init.sql` only runs automatically on a brand-new volume. Run `npm run db:init` against the DB (safe: it only adds what's missing), or reset with `down -v`. |
| Store shows "Cannot reach the server. Is the backend running?" | Backend is down. `docker compose ps`, then `docker compose logs backend`. In Option B, check `npm run dev:env` is running. |
| Store shows "Service temporarily unavailable" / `/api/health/ready` returns 503 | API is up but the database isn't reachable: `docker compose ps db`, `docker compose logs db`. |
| `frontend` stuck as "Waiting" / "dependency failed to start" | The backend never became healthy. Check `docker compose logs backend`. |
| Code changes don't show up in Docker | Images are built once. Run `docker compose up --build -d`. |
| `npm` / `node` is not recognized | Reopen PowerShell after installing Node.js; check that `node -v` works. |
| `npm.ps1 cannot be loaded because running scripts is disabled` | Run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `npm ci` fails with "package-lock.json is out of sync" | You edited `package.json` by hand. Run `npm install` to update the lockfile and commit both files. |
| Tests show `11 skipped` | Normal without a test database. See section 12 to run them. |
| `Refusing to run destructive tests against database 'shop'` | Safety guard. Use a database whose name ends in `_test`. |
| CI backend job: `REQUIRE_TEST_DATABASE is set but TEST_DATABASE_URL is missing` | The workflow's `env:` block was changed. Restore `TEST_DATABASE_URL`. |
| CI fails with `Jest: "global" coverage threshold for lines (85%) not met` | New code without tests. Add tests, or look at the coverage artifact to see which lines are untested. |
| CI docker job fails but tests passed | Open the step **Show container status and logs on failure** in the job log. |
| Emoji show as `?` in `psql` on Windows | Run `chcp 65001` first to switch the terminal to UTF-8. |
| Docker is using lots of disk space | `docker system df` to see usage, then the safe commands in section 17. |

## 19. Security notes

- **Secrets stay out of Git.** Real values live only in `.env` files, which `.gitignore` excludes.
  Committed `.env.example` files contain placeholders only. No Dockerfile or workflow contains a
  real secret.
- **CI passwords are throwaway.** The workflow's PostgreSQL password protects a database that exists
  for a few minutes on a private runner; the docker job generates a random one. For real secrets, use
  **Settings → Secrets and variables → Actions** and reference them as `${{ secrets.NAME }}`.
- **SQL injection prevention.** Every query uses parameters (`$1`, `$2`); user input is never
  pasted into SQL strings.
- **Input validation.** Request bodies, IDs and query parameters are validated before use; the
  JSON body size is limited to 100 kB.
- **No leaked internals.** Unexpected errors return a generic message; details (stack traces, SQL,
  hostnames) only go to the server log. Database passwords are never logged.
- **Data integrity in the database itself.** `CHECK (stock >= 0)`, foreign keys and transactions
  protect data even if application code has a bug.
- **Least privilege.** The API container runs as the non-root `node` user; the CI token is read-only;
  third-party actions are pinned to commit SHAs.
- **HTTP hardening.** nginx hides its version and sends `X-Content-Type-Options`, `X-Frame-Options`
  and `Referrer-Policy` headers. Express's `X-Powered-By` header is disabled. CORS only allows the
  configured origins.
- **Out of scope** (it's a learning project): user accounts/authentication, payments, HTTPS, rate limiting.

## 20. Suggested next learning steps

1. **Linting:** add ESLint + Prettier and a `lint` job to CI.
2. **Frontend tests:** Vitest + React Testing Library for the cart hook and components.
3. **End-to-end tests:** Playwright tests that click through the store in a real browser in CI.
4. **Dependabot:** `.github/dependabot.yml` for automatic dependency and action update PRs.
5. **Container registry:** build and push images to GitHub Container Registry (`ghcr.io`) on version tags.
6. **Image scanning:** scan images for vulnerabilities in CI (e.g. Trivy).
7. **Migrations:** replace `init.sql` with versioned migrations (e.g. `node-pg-migrate`).
8. **Observability:** structured JSON logs, a `/metrics` endpoint, Prometheus + Grafana in Compose.
9. **Kubernetes:** run the same images on a local cluster (kind or Docker Desktop's Kubernetes).
10. **Deployment** (when you're ready to learn it, and aware of costs): staging/production environments
    with manual approval gates in GitHub Actions.
