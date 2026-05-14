-- Fix for Activity Trends Chart (Admin Dashboard)
-- This function aggregates activity counts by date on the server side
-- It runs with SECURITY DEFINER to bypass RLS restrictions, allowing admins to see full stats

CREATE OR REPLACE FUNCTION get_activity_trends(days_lookback INT DEFAULT 30)
RETURNS TABLE (
  activity_date DATE,
  lesson_plans BIGINT,
  assignments BIGINT,
  submissions BIGINT,
  messages BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(
      CURRENT_DATE - (days_lookback - 1),
      CURRENT_DATE,
      '1 day'::interval
    )::DATE as date
  )
  SELECT
    ds.date,
    (SELECT COUNT(*) FROM lesson_plans WHERE created_at >= ds.date AND created_at < ds.date + INTERVAL '1 day')::BIGINT,
    (SELECT COUNT(*) FROM assignments WHERE created_at >= ds.date AND created_at < ds.date + INTERVAL '1 day')::BIGINT,
    (SELECT COUNT(*) FROM assignment_submissions WHERE submitted_at >= ds.date AND submitted_at < ds.date + INTERVAL '1 day')::BIGINT,
    (SELECT COUNT(*) FROM conversation_messages WHERE created_at >= ds.date AND created_at < ds.date + INTERVAL '1 day')::BIGINT
  FROM date_series ds
  ORDER BY ds.date;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_activity_trends(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_activity_trends(INT) TO service_role;

-- Comment to explain usage
COMMENT ON FUNCTION get_activity_trends IS 'Returns daily activity counts for the dashboard. Bypasses RLS.';
