CREATE OR REPLACE FUNCTION notify_dodge_insert() RETURNS trigger AS $$
DECLARE
    dodge_data json;
BEGIN
    SELECT row_to_json(t)
    INTO dodge_data
    FROM (
        SELECT 
            d.dodge_id AS "dodgeId", 
            r.game_name AS "gameName", 
            r.tag_line AS "tagLine", 
            r.lolpros_slug AS "lolProsSlug", 
            s.profile_icon_id AS "profileIconId", 
            d.region AS "riotRegion", 
            d.rank_tier AS "rankTier", 
            d.lp_before AS "lp", 
            d.lp_before - d.lp_after AS "lpLost", 
            d.created_at AS "time"
        FROM dodges d
        JOIN summoners s ON d.summoner_id = s.summoner_id AND d.region = s.region
        JOIN riot_ids r ON s.puuid = r.puuid
        WHERE NEW.dodge_id = d.dodge_id
    ) t;

    PERFORM pg_notify('dodge_insert', dodge_data::text);
    RETURN NEW;
END;

$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_notify_dodge_insert
AFTER INSERT ON dodges
FOR EACH ROW
EXECUTE FUNCTION notify_dodge_insert();
