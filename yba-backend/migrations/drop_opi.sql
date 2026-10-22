-- FPTS is computed from box-score columns at query time, so the stored OPI column is no longer read or written.
-- Run once against the `yba` database before the next data dump, so inserts without OPI don't fail if the column is NOT NULL.
ALTER TABLE version2 DROP COLUMN OPI;
