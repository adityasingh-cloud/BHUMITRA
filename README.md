# Bhumitra — National Land Acquisition & Management System (Backend)

**Department of Land Resources (DoLR), Ministry of Rural Development, Government of India**  
*Built for Smart India Hackathon 2026 (Problem Statement SIH26016)*

Bhumitra is a national-scale federated land acquisition platform digitizing the complete lifecycle under the **RFCTLARR Act, 2013** across all 36 States/UTs — featuring PostGIS spatial polygon verification, statutory compensation calculation, cryptographic SHA-256 audit hashing, explainable ML litigation & delay-risk prediction, pluggable state adapters (West Bengal Banglarbhumi reference implementation), and a public non-PII transparency portal.

---

## 🚀 Quick Start Guide

### Option 1: One-Command Docker Setup (Recommended)

Spins up the entire microservice stack:
- **Node.js Express API Gateway**: `http://localhost:5000`
- **Swagger OpenAPI Docs**: `http://localhost:5000/api/docs`
- **Python FastAPI Risk Microservice**: `http://localhost:8000/docs`
- **PostgreSQL 15 + PostGIS**: `localhost:5432`
- **RabbitMQ Management**: `http://localhost:15672` (Credentials: `bhumitra` / `bhumitra123`)
- **MinIO Object Storage**: `http://localhost:9001` (Credentials: `minioadmin` / `minioadminpassword`)

```bash
# Clone repository and start container stack
docker-compose up --build -d
```

---

### Option 2: Local Development Setup (Manual)

#### 1. Start PostgreSQL + PostGIS & Redis/RabbitMQ
Ensure PostgreSQL is running locally with PostGIS extension enabled:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### 2. Setup Node.js Express Backend
```bash
cd backend
npm install
cp .env.example .env

# Run Prisma migrations & seed reference data (36 States/UTs, 23 WB districts, workflow stages, users)
npx prisma db push
node prisma/seed.js

# Start backend server
npm run dev
```

#### 3. Setup Python FastAPI ML Service
```bash
cd ml_service
pip install -r requirements.txt

# Generate synthetic training dataset & train risk classifier model
python generate_dataset.py
python train_model.py

# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 📜 Database Schema & Master Seed Data

The PostgreSQL + PostGIS database is seeded with:
1. **All 36 States and Union Territories of India** with effective-dating support (`support_from`, `support_until`).
2. **West Bengal's 23 Districts** as the primary reference dataset.
3. **9 Statutory RFCTLARR Workflow Stages**:
   - `Proposal` (30 days SLA)
   - `Preliminary Notification (Sec 11)` (60 days SLA)
   - `SIA Survey` (90 days SLA)
   - `Public Hearing` (30 days SLA)
   - `Expert Appraisal` (45 days SLA)
   - `Declaration (Sec 19)` (60 days SLA)
   - `Award (Sec 23-30)` (90 days SLA)
   - `Possession (Sec 31-37)` (60 days SLA)
   - `R&R` (180 days SLA)
4. **Seed RBAC Users**:
   - `admin@bhumitra.gov.in` (`dolr_admin`)
   - `nhai@bhumitra.gov.in` (`requiring_body`)
   - `lao.hooghly@bhumitra.gov.in` (`lao_district`)
   - `state.wb@bhumitra.gov.in` (`state_official`)
   - `central.mord@bhumitra.gov.in` (`central_ministry`)
   - `landowner.wb@bhumitra.gov.in` (`landowner`)
   - **Password for all seed users**: `Bhumitra@2026`

---

## 🌐 API Integrations Breakdown (LIVE vs MOCKED)

| Integration | Status | Rationale & Implementation Details |
| :--- | :--- | :--- |
| **Bhuvan (ISRO) WMS** | **LIVE / Real API** | Queries ISRO Bhuvan LULC thematic satellite service for restriction overlay checks (`multi_crop_irrigated`). Fallback cached boundary lookup for offline resilience. |
| **OpenStreetMap Overpass** | **LIVE / Real API** | Real administrative polygon geometry traced for pilot West Bengal districts to seed authentic land boundary spatial coordinates. |
| **PFMS / Direct Benefit Transfer** | **MOCKED Stub** | Built against official Ministry of Finance PFMS reporting schema. Simulates DBT payment processing & account validation receipts. |
| **ULPIN Central Registry** | **MOCKED Stub** | Built against Ministry of Rural Development 14-character alphanumeric ULPIN spec. Live government access requires state MoU authorization. |
| **NGDRS Deed Registration** | **MOCKED Stub** | Stubbed against National Generic Document Registration System API spec. |

---

## 🔌 State Pluggable Adapter Architecture (Module 9)

To support scaling across all 36 States/UTs without core code modifications:
- Each state adapter is located in `backend/src/adapters/` extending `BaseStateAdapter`.
- `WestBengalAdapter` maps **Banglarbhumi** specific fields (`Khatian`, `Mouza`, `JL Number`) to canonical Bhumitra schema.
- Synchronizations are routed through **RabbitMQ** with dead-letter exchange retry queues (`x-message-ttl: 5000ms`).

---

## 📚 Complete REST API Contract for Frontend Integration

Interactive OpenAPI Swagger UI is available live at `http://localhost:5000/api/docs`.

### 1. Authentication (`/api/auth`)
- `POST /api/auth/register` — Register user with RBAC role
- `POST /api/auth/login` — Returns JWT bearer token

### 2. Spatial Land Parcel Verifier (`/api/parcels`)
- `POST /api/parcels/verify` — Accepts GeoJSON project boundary, executes PostGIS spatial intersection, queries Bhuvan LULC, runs ULPIN priority pipeline, auto-creates grievance tickets for unverified title parcels.

### 3. RFCTLARR Compensation Engine (`/api/compensation`)
- `POST /api/compensation/calculate` — Computes 6-step statutory award sequence:
  1. `market_value` = MAX(circle_rate, avg_top_50pct_sale_deeds, comparable_area_avg)
  2. `base` = market_value × rural_multiplier (1.0 - 2.0 based on distance)
  3. `base` += total_asset_value (structures, trees, wells, crops)
  4. `solatium` = 100% × base (excl. interest per *RB Dealers 2019* SC judgment)
  5. `interest` = 12% p.a. × market_value for duration
  6. `total` = base + solatium + interest
  - Automatically logs hash chain into Cryptographic Audit Vault and returns PFMS receipt.

### 4. SIA Lifecycle Tracker (`/api/projects`)
- `POST /api/projects` — Create project at Proposal stage
- `PATCH /api/projects/:id/advance-stage` — Move to next statutory stage, recalculates SLA
- `GET /api/projects/:id/status` — Get elapsed days, consumed SLA %, status
- `PATCH /api/projects/:id/consent` — Record public SIA consent % (re-evaluates risk)
- `GET /api/projects/:id/risk` — Fetch explainable Litigation & Delay Risk score (Module 5)

### 5. Cryptographic Audit Vault (`/api/audit` & `/api/documents`)
- `POST /api/documents/upload` — Upload land document & store SHA-256 chain hash
- `GET /api/audit/verify/:referenceId` — Verify cryptographic chain integrity (`chainIntact: true/false`)

### 6. Grievance SLA Tracker (`/api/grievances`)
- `POST /api/grievances` — Submit land title correction ticket (15-day SLA)
- `GET /api/grievances/:id` — Track status
- `PATCH /api/grievances/:id/resolve` — Authorized officer resolve/reject (updates parcel provenance)

### 7. Public Case-Transparency Portal (`/api/public`)
- `GET /api/public/projects/search` — Public project search (No auth required)
- `GET /api/public/projects/:id` — Aggregate non-identifying metrics (No PII / Bank details)

### 8. Federated State Adapters Admin (`/api/admin`)
- `GET /api/admin/adapters` — List 36 State adapters status
- `POST /api/admin/adapters/trigger-sync` — Publish sync job to RabbitMQ queue

---

## 🧪 Postman Collection Usage

1. Import `bhumitra_postman_collection.json` into Postman.
2. Set environment variable `baseUrl` to `http://localhost:5000`.
3. Execute **Authentication -> Login User**. The collection automatically stores the `bearerToken` and passes it to protected route headers.
