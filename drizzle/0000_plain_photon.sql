CREATE TABLE `prompt_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`config_json` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`tags` text DEFAULT '[]',
	`system_template` text NOT NULL,
	`user_template` text,
	`variables_schema` text DEFAULT '{}',
	`config_schema` text,
	`examples` text DEFAULT '[]',
	`use_count` integer DEFAULT 0,
	`last_used_at` integer,
	`version` integer DEFAULT 1,
	`source_file` text,
	`content_hash` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text,
	`prompt_title` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`variables` text DEFAULT '{}',
	`rendered_system_prompt` text NOT NULL,
	`rendered_user_prompt` text,
	`user_input` text,
	`response` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`latency_ms` integer,
	`estimated_cost` real,
	`status` text DEFAULT 'completed' NOT NULL,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `secrets` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`api_key` text NOT NULL,
	`is_valid` integer DEFAULT true,
	`last_validated_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `secrets_provider_unique` ON `secrets` (`provider`);