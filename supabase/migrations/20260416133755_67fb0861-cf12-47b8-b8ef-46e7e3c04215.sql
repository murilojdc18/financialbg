
CREATE OR REPLACE FUNCTION public.create_operation_with_receivables(
  p_client_id uuid,
  p_principal numeric,
  p_rate_monthly numeric,
  p_term_months integer,
  p_system operation_system,
  p_start_date date,
  p_fee_fixed numeric DEFAULT 0,
  p_fee_insurance numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_receivables jsonb DEFAULT '[]'::jsonb,
  p_cash_source text DEFAULT 'B&G'
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_operation_id uuid;
  v_receivable jsonb;
BEGIN
  -- Input validation
  IF p_client_id IS NULL THEN
    RAISE EXCEPTION 'client_id cannot be null';
  END IF;

  IF p_principal <= 0 THEN
    RAISE EXCEPTION 'principal must be greater than 0';
  END IF;

  IF p_rate_monthly < 0 THEN
    RAISE EXCEPTION 'rate_monthly cannot be negative';
  END IF;

  IF p_term_months <= 0 THEN
    RAISE EXCEPTION 'term_months must be greater than 0';
  END IF;

  IF p_cash_source NOT IN ('B&G', 'PESSOAL') THEN
    RAISE EXCEPTION 'cash_source must be B&G or PESSOAL';
  END IF;

  -- Insert operation
  INSERT INTO public.operations (
    client_id, principal, rate_monthly, term_months,
    system, start_date, fee_fixed, fee_insurance, notes, cash_source
  ) VALUES (
    p_client_id, p_principal, p_rate_monthly, p_term_months,
    p_system, p_start_date, COALESCE(p_fee_fixed, 0), COALESCE(p_fee_insurance, 0), p_notes, p_cash_source
  )
  RETURNING id INTO v_operation_id;

  -- Insert receivables atomically
  FOR v_receivable IN SELECT * FROM jsonb_array_elements(p_receivables)
  LOOP
    INSERT INTO public.receivables (
      operation_id, client_id, installment_number, due_date, amount
    ) VALUES (
      v_operation_id,
      p_client_id,
      (v_receivable->>'installment_number')::integer,
      (v_receivable->>'due_date')::date,
      (v_receivable->>'amount')::numeric
    );
  END LOOP;

  RETURN v_operation_id;
END;
$function$;
