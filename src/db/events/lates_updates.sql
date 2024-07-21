CREATE OR REPLACE FUNCTION notify_region_update()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('region_update', row_to_json(NEW)::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER region_update_trigger
AFTER INSERT OR UPDATE ON dodgetracker.latest_updates
FOR EACH ROW EXECUTE FUNCTION notify_region_update();
