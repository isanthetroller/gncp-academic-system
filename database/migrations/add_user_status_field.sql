-- Migration to ensure user status column exists in station_users
-- status is already part of the default database schema.sql

ALTER TABLE `station_users` ADD COLUMN IF NOT EXISTS `status` VARCHAR(20) DEFAULT 'PENDING' AFTER `role`;
