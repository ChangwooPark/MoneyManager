# Project: TypeScript Serverless Account Book (가계부)
## Tech Stack: TypeScript, Node.js, Cloud Run, Firestore

## 🎯 System Architecture Overview
- **Backend/Frontend**: TypeScript App containerized via Docker, deployed on Google Cloud Run.
- **Database**: Google Cloud Firestore (Native Mode, asia-northeast3 region).
- **Core Strategy**: Maximize GCP Free Tier, keep 'Max Instances' limited to minimize cost.

---

## 🛠️ Implementation Roadmap & Checklist

### Phase 1: Local Development & Base Setup
- [ ] Initialize Node.js & TypeScript project (`npm init`, install `typescript`, `@types/node`, `ts-node`).
- [ ] Configure `tsconfig.json` for proper compilation.
- [ ] Implement lightweight API framework (e.g., Express) using TypeScript.
  - *Constraint*: Must listen on environment variable port (`process.env.PORT` || 8080).
- [ ] Integrate `@google-cloud/firestore` SDK and implement basic CRUD operations for account book logs.

### Phase 2: Containerization (Docker)
- [ ] Write build script (`tsc`) in `package.json` to compile `.ts` to `.js`.
- [ ] Create a multi-stage or optimized `Dockerfile` for Node.js production.
- [ ] Verify local container execution (`docker build` & `docker run`) and port mapping.

### Phase 3: GCP Infrastructure Provisioning
- [ ] Enable GCP Project & Link Billing Account.
- [ ] Provision **Firestore Database** in **Native Mode** (Region: `asia-northeast3` / Seoul).
- [ ] Create a Docker repository in **Artifact Registry** (Region: `asia-northeast3`).

### Phase 4: CI/CD & Cloud Run Deployment
- [ ] Authenticate local environment using Google Cloud SDK (`gcloud auth login`).
- [ ] Submit container build to Cloud Build:
  - `gcloud builds submit --tag asia-northeast3-docker.pkg.dev/[PROJECT_ID]/[REPO_NAME]/account-book:v1`
- [ ] Deploy service to **Cloud Run**:
  - Region: `asia-northeast3`
  - Ingress: Allow all (or internal based on auth design)
  - **CRITICAL COST CONTROL**: Set `--max-instances=1` (or 2) to strictly prevent auto-scaling billing surprises.

### Phase 5: Security & Verification
- [ ] Ensure Cloud Run Service Account has `Cloud Datastore User` (Firestore) IAM permission.
- [ ] (Optional) Map Custom Domain via Cloud Run Domain Mapping.

---

## ⚠️ AI Agent Coding Rules & Constraints
1. **TypeScript Strict Mode**: Always write type-safe code. Avoid using `any` types.
2. **Environment Variables**: Never hardcode credentials. Use GCP's runtime environment or Secret Manager if needed.
3. **Stateless Service**: Cloud Run is stateless. Do not save temporary transaction files or session data to local container disk; use Firestore.