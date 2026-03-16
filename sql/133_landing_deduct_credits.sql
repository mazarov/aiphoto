-- Atomic credit deduction for landing users
CREATE OR REPLACE FUNCTION landing_deduct_credits(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_credits int;
BEGIN
  UPDATE landing_users
  SET credits = credits - p_amount, updated_at = now()
  WHERE id = p_user_id AND credits >= p_amount
  RETURNING credits INTO v_credits;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  RETURN v_credits;
END;
$$;
