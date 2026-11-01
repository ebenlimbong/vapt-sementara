Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'pentester');

-- CreateEnum
CREATE TYPE "AppCategory" AS ENUM ('web', 'api');

-- CreateEnum
CREATE TYPE "AppEnvironment" AS ENUM ('staging', 'lab');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('diajukan', 'disetujui', 'berjalan', 'selesai', 'ditolak');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'rejected');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('web_scan', 'api_access_test', 'retest');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'done', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('baru', 'terverifikasi_jadi_temuan', 'alarm_palsu');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('baru', 'dikerjakan', 'menunggu_retest', 'selesai');

-- CreateEnum
CREATE TYPE "RetestResult" AS ENUM ('tertutup', 'masih_terbuka');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('technical', 'executive');

-- CreateEnum
CREATE TYPE "AccessExpectation" AS ENUM ('allow', 'deny');

-- CreateEnum
CREATE TYPE "AccessVerdict" AS ENUM ('sesuai', 'menyimpang');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "role" "Role" NOT NULL DEFAULT 'pentester',
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "category" "AppCategory" NOT NULL,
    "environment" "AppEnvironment" NOT NULL,
    "rating" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_requests" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "target_url" TEXT NOT NULL,
    "desired_start" TIMESTAMP(3) NOT NULL,
    "desired_end" TIMESTAMP(3) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'diajukan',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_versions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "diff_summary" JSONB,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_approvals" (
    "id" TEXT NOT NULL,
    "scope_version_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "reason" TEXT,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scope_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_windows" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "approved_scope_id" TEXT NOT NULL,
    "scope_version_id" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "test_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_jobs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "scope_version_id" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "current_stage" TEXT,
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "cancel_requested" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "created_by" TEXT NOT NULL,
    "queued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "scan_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_job_events" (
    "id" BIGSERIAL NOT NULL,
    "job_id" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_job_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_specs" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "rejected_refs" JSONB,
    "imported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_specs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_endpoints" (
    "id" TEXT NOT NULL,
    "spec_id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "params" JSONB,
    "in_scope" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "api_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_accounts" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "role_label" TEXT NOT NULL,
    "credential_ref" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_scenarios" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "actor_account_id" TEXT,
    "actor_role" TEXT NOT NULL,
    "expected" "AccessExpectation" NOT NULL,
    "actual" TEXT,
    "verdict" "AccessVerdict",
    "job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "endpoint_id" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "raw_payload" JSONB,
    "status" "CandidateStatus" NOT NULL DEFAULT 'baru',
    "dismiss_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "findings" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "candidate_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "steps" TEXT,
    "impact" TEXT,
    "severity" "Severity" NOT NULL,
    "cvss_vector" TEXT,
    "cvss_score" DOUBLE PRECISION,
    "status" "FindingStatus" NOT NULL DEFAULT 'baru',
    "owner_response" TEXT,
    "due_date" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "findings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" TEXT NOT NULL,
    "finding_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remediation_events" (
    "id" BIGSERIAL NOT NULL,
    "finding_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "note" TEXT,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remediation_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retests" (
    "id" TEXT NOT NULL,
    "finding_id" TEXT NOT NULL,
    "job_id" TEXT,
    "result" "RetestResult" NOT NULL,
    "note" TEXT,
    "verified_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_vault" (
    "id" TEXT NOT NULL,
    "app_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credential_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "request_id" TEXT,
    "app_id" TEXT NOT NULL,
    "report_type" "ReportType" NOT NULL,
    "file_path" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "generated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "scope_versions_request_id_version_no_key" ON "scope_versions"("request_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "test_windows_approved_scope_id_key" ON "test_windows"("approved_scope_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_accounts_credential_ref_key" ON "test_accounts"("credential_ref");

-- CreateIndex
CREATE UNIQUE INDEX "findings_candidate_id_key" ON "findings"("candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "evidence_finding_id_version_no_key" ON "evidence"("finding_id", "version_no");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_requests" ADD CONSTRAINT "test_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_versions" ADD CONSTRAINT "scope_versions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "test_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_versions" ADD CONSTRAINT "scope_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_approvals" ADD CONSTRAINT "scope_approvals_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "scope_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_approvals" ADD CONSTRAINT "scope_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_windows" ADD CONSTRAINT "test_windows_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "test_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_windows" ADD CONSTRAINT "test_windows_approved_scope_id_fkey" FOREIGN KEY ("approved_scope_id") REFERENCES "scope_approvals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_windows" ADD CONSTRAINT "test_windows_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "scope_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "test_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_scope_version_id_fkey" FOREIGN KEY ("scope_version_id") REFERENCES "scope_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_job_events" ADD CONSTRAINT "scan_job_events_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_specs" ADD CONSTRAINT "api_specs_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_specs" ADD CONSTRAINT "api_specs_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_endpoints" ADD CONSTRAINT "api_endpoints_spec_id_fkey" FOREIGN KEY ("spec_id") REFERENCES "api_specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_accounts" ADD CONSTRAINT "test_accounts_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_accounts" ADD CONSTRAINT "test_accounts_credential_ref_fkey" FOREIGN KEY ("credential_ref") REFERENCES "credential_vault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_scenarios" ADD CONSTRAINT "access_scenarios_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "api_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_scenarios" ADD CONSTRAINT "access_scenarios_actor_account_id_fkey" FOREIGN KEY ("actor_account_id") REFERENCES "test_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_scenarios" ADD CONSTRAINT "access_scenarios_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scan_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "api_endpoints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "findings" ADD CONSTRAINT "findings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_events" ADD CONSTRAINT "remediation_events_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_events" ADD CONSTRAINT "remediation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retests" ADD CONSTRAINT "retests_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retests" ADD CONSTRAINT "retests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "scan_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retests" ADD CONSTRAINT "retests_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_vault" ADD CONSTRAINT "credential_vault_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_vault" ADD CONSTRAINT "credential_vault_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "test_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_app_id_fkey" FOREIGN KEY ("app_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

