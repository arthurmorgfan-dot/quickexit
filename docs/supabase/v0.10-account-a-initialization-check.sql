-- PREPARED ONLY: do not execute without separate approval.
-- Confirm dashboard project: quickexit-dev / kxtsetdqsqxtqyyfjmpk.
-- Copy Account A's User UID privately from Authentication > Users > A.
-- Replace ACCOUNT_A_UUID_HERE in the SQL Editor only; do not save the real UID
-- in this repository or share it in chat. Keep the role postgres (dashboard
-- administrator), so RLS cannot produce misleading zero counts.
-- One SELECT statement, no RPCs, session operations, settings or writes.
-- The placeholder intentionally fails UUID conversion until replaced.
WITH account_a AS (
  SELECT 'ACCOUNT_A_UUID_HERE'::uuid AS user_id
), counts AS (
  SELECT
    (SELECT count(*) FROM public.paper_workspaces w
     WHERE w.user_id = a.user_id) AS paper_workspace_count,
    (SELECT count(*) FROM public.paper_operations o
     WHERE o.user_id = a.user_id) AS paper_operation_count
  FROM account_a a
)
SELECT
  paper_workspace_count > 0 AS has_paper_workspace,
  paper_workspace_count,
  paper_operation_count > 0 AS has_paper_operations,
  paper_operation_count
FROM counts;
