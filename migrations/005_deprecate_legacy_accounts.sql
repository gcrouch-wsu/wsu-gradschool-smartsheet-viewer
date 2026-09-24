-- Deprecate legacy account tables (data already migrated in 004_unified_users.sql).
-- App code reads users / user_roles / role_permissions. Old tables remain for rollback
-- until a future migration drops them after production verification.
--
-- Do not DROP admin_users, student_users, contributor_users, or form_approver_users here.

SELECT 1;
