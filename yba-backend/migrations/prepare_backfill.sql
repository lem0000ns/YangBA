-- Full reload of box scores and games for API-Sports backfill (2023-24 onward).
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE version2;
TRUNCATE TABLE games;
SET FOREIGN_KEY_CHECKS = 1;
