CREATE TABLE IF NOT EXISTS "dodgetracker"."latest_updates" (
	"region" varchar(5) PRIMARY KEY NOT NULL,
	"update_time" timestamp with time zone DEFAULT now() NOT NULL
);