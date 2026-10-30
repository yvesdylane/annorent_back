# Plan: Consolidate business_accounts and businesses into single table

## Problem
Two tables exist:
- `business_accounts` (001_initial_schema.sql): operational table referenced by `properties.account_id` and `subscription_plans.account_id` - `account_id`, `user_id`, `business_name` (NOT NULL), `tax_info`, `verification_status`
- `businesses` (004_business_kyc.sql): KYC details table with rccm/niu/legal rep info

Domain says only `business_accounts` owns properties. Need single source of truth.

## Solution
Extend `business_accounts` with all KYC fields, migrate data from `businesses`, update code to use only `business_accounts`, drop `businesses` table.

## Changes

### 1. New migration 005_consolidate_business.sql
Add columns to business_accounts: applicant_type, rccm_number, niu_number, legal_representative_name, legal_representative_phone, kyc_submission_id. Make user_id unique. Migrate from businesses. Update verified owners. Drop businesses table.

### 2. Update KycService.approve()
Only write to business_accounts with all KYC fields.

### 3. Backfill
Ensure all verified owners have business_accounts entries.

### 4. Clean up
Remove references to businesses table.
