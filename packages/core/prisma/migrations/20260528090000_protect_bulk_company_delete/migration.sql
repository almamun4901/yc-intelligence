CREATE OR REPLACE FUNCTION "prevent_bulk_company_delete"()
RETURNS trigger AS $$
DECLARE
  deleted_count integer;
  override_setting text;
BEGIN
  SELECT COUNT(*) INTO deleted_count FROM deleted_companies;
  override_setting := COALESCE(
    current_setting('yc_intelligence.allow_bulk_company_delete', true),
    ''
  );

  IF deleted_count > 1 AND override_setting NOT IN ('1', 'true', 'on') THEN
    RAISE EXCEPTION
      'Refusing to delete % companies at once because company-linked data cascades to embeddings, jobs, HN posts, and founders. Set yc_intelligence.allow_bulk_company_delete=on for an intentional maintenance delete.',
      deleted_count;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "prevent_bulk_company_delete" ON "companies";

CREATE TRIGGER "prevent_bulk_company_delete"
AFTER DELETE ON "companies"
REFERENCING OLD TABLE AS deleted_companies
FOR EACH STATEMENT
EXECUTE FUNCTION "prevent_bulk_company_delete"();
