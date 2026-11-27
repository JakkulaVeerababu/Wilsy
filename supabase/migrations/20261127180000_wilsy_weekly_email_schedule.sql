-- Start the weekly email workflow every day at 04:30 UTC (10:00 IST). collectors/digest.mjs sends each
-- subscriber at most once a week, so a daily run only catches whoever is due.
-- Pause: select cron.unschedule('wilsy-dispatch-send-weekly');
select cron.schedule('wilsy-dispatch-send-weekly', '30 4 * * *',
  $$select wilsy_private.dispatch_workflow_with_inputs('send-weekly.yml', '{"dry_run":"false","max_emails":"50"}'::jsonb)$$);
