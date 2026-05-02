# Stage 3 Demo Script

## Target Length
5 to 10 minutes.

## What To Open Before Recording
- `backend/server.js`
- `backend/schema.sql`
- `frontend/src/App.jsx`
- `frontend/src/App.css`
- `frontend/src/index.css`

## Verbatim Script

### Opening
"Hi, my project is TraceGreen Logistics. It is a PERN stack application for managing shipments, vehicles, and drivers. The main features are shipment CRUD, inline creation of vehicles and drivers, and an emissions report. The backend uses Express and PostgreSQL, and the frontend uses React and Vite."

Show `frontend/src/App.jsx` around lines 337 to 357.

### SQL Injection Protection
"First, I want to talk about SQL injection protection. In this application, I use parameterized SQL everywhere user input reaches the database. Instead of building SQL by concatenating strings, I pass values as parameters using placeholders like `$1`, `$2`, and so on. I also validate and normalize inputs before they reach the database. For example, vehicle type and fuel type are mapped through a fixed allowlist, and numeric fields are converted and checked before insert."

Show `backend/server.js` lines 82 to 99, then 117 to 125, then 170 to 193, then 287 to 305.

"The main defense here is the use of `pool.query` with a separate array of values. That prevents user input from being interpreted as SQL code. On top of that, `vehicleTypeMap` and `fuelTypeMap` work like allowlists, so only valid categorical values can be saved. I also convert numeric values with `Number(...)` so raw strings do not get passed into numeric columns. So the short version is that the app prevents SQL injection by combining input validation with prepared statements and allowlisted categorical values."

### Indexes
"Next, I want to discuss indexes. I added indexes for the queries that matter most in the app, especially the shipment list and the emissions report. These indexes are tied to specific query paths rather than being added just for completeness."

Show `backend/schema.sql` lines 38 to 40, then `backend/server.js` lines 131 to 151, then 279 to 305.

"The first index is `idx_shipments_date` on `shipments(shipment_date)`. This supports the emissions report filter `WHERE s.shipment_date BETWEEN $1 AND $2`, and it also helps the report sorting with `ORDER BY s.shipment_date ASC, s.shipment_id ASC`. The second index is `idx_vehicles_type` on `vehicles(vehicle_type)`. That supports the report filter `AND v.vehicle_type = $3`, which narrows the report to one vehicle type. The third index is `idx_shipments_vehicle` on `shipments(vehicle_id)`. That supports the main shipment listing join to `vehicles`, and it is also useful for lookup patterns tied to a specific vehicle."

"The emissions report is where indexes matter most because it filters by date range and vehicle type, then computes CO2 totals. The main shipment list also benefits from join-friendly indexing because it is the default screen users open most often. So the short rubric-ready summary is that the report query benefits from `idx_shipments_date` and `idx_vehicles_type`, while the main shipment list benefits from `idx_shipments_vehicle`."

### Transactions and Isolation Level
"Next, I want to explain transactions and concurrency. Shipment creation, update, and delete are wrapped in transactions so the shipment row and its assignment row stay consistent. I explicitly use `READ COMMITTED`, which is PostgreSQL’s common default isolation level, and it is a good balance for this app. I do not need serializable isolation here because each request is short and focused, and the main goal is avoiding partial writes rather than enforcing a globally ordered workflow. If two users work at the same time, `READ COMMITTED` prevents dirty reads while keeping concurrency reasonable."

Show `backend/server.js` lines 170 to 196, 211 to 250, and 256 to 276.

"The transaction boundary is `BEGIN ISOLATION LEVEL READ COMMITTED`. `COMMIT` only happens after both the shipment write and the assignment write succeed. If anything fails, `ROLLBACK` runs, so there is no half-finished data. If I explain concurrency in one sentence, I would say that multiple users can safely create or edit shipments at the same time because each write is isolated inside a short transaction, and the foreign keys and uniqueness constraints still protect referential integrity."

### AI Usage
"I also want to briefly discuss AI usage. I used AI as a development assistant for brainstorming, code review help, and writing support for this demo script. It helped me organize the explanation of security, indexing, transactions, and UI polish. The actual database logic, API design, and validation were still implemented and verified in the project code itself. In other words, AI helped with drafting and organization, but I validated the code changes locally and kept the core implementation in my own project structure."

### UI Walkthrough
"I also refreshed the UI so it feels more like a dashboard than a plain form page. The hero section now summarizes live counts of vehicles, drivers, shipments, and vehicle types. The tables and forms use a darker modern palette, clearer spacing, and responsive card-style behavior."

Show `frontend/src/App.jsx` lines 66 to 87, then 337 to 357, plus `frontend/src/App.css` and `frontend/src/index.css`.

### Live Feature Demo
"Now I will show the app live. I will open Shipment Management, add a vehicle inline, add a driver inline, create a shipment, edit the shipment, delete the shipment, then switch to the Emissions Impact Report, choose a date range and vehicle type, and generate the report so I can point to the computed totals."

### Closing
"To close, this project demonstrates SQL injection protection, indexed report queries, transactional writes, and a simple multi-user concurrency strategy. The UI update also makes the demo easier to present and easier to understand."

## How To Run The Project

### Backend Setup
From `backend/`:
```bash
npm install
npm run db:schema
npm run db:seed
```

If your local database is already created, make sure these environment variables are set before starting the backend:
- `PGHOST`
- `PGPORT`
- `PGUSER`
- `PGPASSWORD`
- `PGDATABASE`

### Start The Backend
From `backend/`:
```bash
npm start
```
The API should be available on `http://localhost:3001` unless `PORT` is overridden.

### Start The Frontend
From `frontend/`:
```bash
npm install
npm run dev
```
Open the Vite URL shown in the terminal, usually `http://localhost:5173`.

### If The Frontend Cannot Reach The Backend
Set `VITE_API_BASE_URL` to the backend base URL, for example:
```bash
VITE_API_BASE_URL=http://localhost:3001/api
```
Then restart the frontend dev server.

## Rubric One-Liners

### SQL Injection
"I used parameterized queries and allowlisted categorical inputs."

### Indexes
"`idx_shipments_date` supports the date-bounded emissions report, `idx_vehicles_type` supports the vehicle-type filter in the emissions report, and `idx_shipments_vehicle` supports the main shipment listing and join lookups."

### Transactions / Isolation
"Shipment create, update, and delete are wrapped in `READ COMMITTED` transactions, which protects against partial writes while keeping concurrency practical for a multi-user app."

### AI Usage
"AI was used for brainstorming, wording help, and UI polish ideas, while the implementation was still validated in the codebase."
