-- Deferred drop of legacy account tables (admin_users, student_users,
-- contributor_users, form_approver_users). Application reads/writes the unified
-- users directory from 004_unified_users.sql. Keep legacy tables until a
-- production sign-in smoke test confirms the unified path, then drop in a
-- follow-up migration.

SELECT 1;
