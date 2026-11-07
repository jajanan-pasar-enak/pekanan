-- ADR-0002: unique index parsial hanya menjaga baris hidup, sehingga perpindahan
-- penulis laporan harus "memensiunkan" baris yang kalah tanpa menghapusnya.
CREATE OR REPLACE FUNCTION retire_transferred_laporan()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD.supervisor_id <> NEW.supervisor_id
		AND NEW.deleted_at IS NULL
		AND EXISTS (
			SELECT 1
			FROM laporan_pekan
			WHERE pekan_id = NEW.pekan_id
				AND supervisor_id = NEW.supervisor_id
				AND deleted_at IS NULL
				AND id <> NEW.id
			FOR UPDATE
		)
	THEN
		NEW.deleted_at := now();
	END IF;
	RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER laporan_pekan_retire_transferred
BEFORE UPDATE OF supervisor_id ON laporan_pekan
FOR EACH ROW
EXECUTE FUNCTION retire_transferred_laporan();
