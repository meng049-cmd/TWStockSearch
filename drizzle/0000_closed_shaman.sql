CREATE TABLE `bars` (
	`instrument` text NOT NULL,
	`date` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`instrument`, `date`)
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`instrument` text NOT NULL,
	`at` text NOT NULL,
	`count` integer NOT NULL,
	`source` text NOT NULL,
	`csv` text
);
--> statement-breakpoint
CREATE TABLE `instruments` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`contract` text DEFAULT '' NOT NULL,
	`session` text DEFAULT '' NOT NULL,
	`unit` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`status` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`instrument` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`updated_at` text NOT NULL
);
