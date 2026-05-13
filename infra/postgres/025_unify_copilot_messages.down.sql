-- 025_unify_copilot_messages.down.sql
-- Reverse the data migration: move curation and ads messages back to their
-- legacy tables. This is a best-effort rollback — any messages created in
-- dropship_copilot_messages after the migration will need manual review.

-- Move curation messages back
INSERT INTO dropship_curation_messages
  (id, session_id, role, content, tool_name, tool_input, tool_output, created_at)
SELECT m.id, m.session_id, m.role, m.content, m.tool_name, m.tool_input, m.tool_output, m.created_at
FROM dropship_copilot_messages m
JOIN dropship_copilot_sessions s ON s.id = m.session_id
WHERE s.mode = 'curation'
ON CONFLICT (id) DO NOTHING;

-- Move ads messages back
INSERT INTO dropship_curation_messages
  (id, session_id, role, content, tool_name, tool_input, tool_output, created_at)
SELECT m.id, m.session_id, m.role, m.content, m.tool_name, m.tool_input, m.tool_output, m.created_at
FROM dropship_copilot_messages m
JOIN dropship_copilot_sessions s ON s.id = m.session_id
WHERE s.mode = 'ads'
ON CONFLICT (id) DO NOTHING;

-- Note: we do NOT delete from dropship_copilot_messages here to avoid
-- data loss on rollback. A manual cleanup can be done after verifying
-- the legacy tables are correct.
