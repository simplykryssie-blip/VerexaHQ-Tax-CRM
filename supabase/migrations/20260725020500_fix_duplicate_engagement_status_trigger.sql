-- Pre-existing bug discovered while testing this phase's activity-log
-- extension: tax_engagements had two separate triggers both calling
-- log_engagement_status_change() on INSERT/status UPDATE
-- (engagement_status_audit and tax_engagement_status_history), so every
-- create or status change logged two identical activity rows. Fixed here
-- because this phase directly extends the affected activity log and the
-- duplicate would otherwise show as doubled entries in the new engagement
-- activity timeline. Keeping tax_engagement_status_history (name matches
-- the table it populates); dropping the redundant one.
drop trigger if exists engagement_status_audit on public.tax_engagements;
