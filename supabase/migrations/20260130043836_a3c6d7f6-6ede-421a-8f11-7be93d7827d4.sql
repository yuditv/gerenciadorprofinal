-- Recreate dispatcher cron job (every 5 minutes)
do $plpgsql$
declare
  v_job_id integer;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'scheduled-dispatcher-every-5-min'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'scheduled-dispatcher-every-5-min',
    '*/5 * * * *',
    $cmd$
    select net.http_post(
        url:='https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/scheduled-dispatcher',
        headers:=jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYW5tbWJneXl4dXF2ZXp1ZGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDU4MzUsImV4cCI6MjA4NDA4MTgzNX0.L_r_WHXWw9BhJ4sR4ozkYKbseLkGtJ79skMD10IwdVE'
        ),
        body:=jsonb_build_object('triggered_by', 'cron')
    ) as request_id;
    $cmd$
  );
end
$plpgsql$;