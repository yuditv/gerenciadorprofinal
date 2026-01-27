-- Schedule renewal reminder to run daily at 9:00 AM (Brazil time)
SELECT cron.schedule(
  'renewal-reminder-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
      url:='https://tlanmmbgyyxuqvezudir.supabase.co/functions/v1/renewal-reminder-scheduler',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsYW5tbWJneXl4dXF2ZXp1ZGlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDU4MzUsImV4cCI6MjA4NDA4MTgzNX0.L_r_WHXWw9BhJ4sR4ozkYKbseLkGtJ79skMD10IwdVE'
      ),
      body:=jsonb_build_object('triggered_by', 'cron')
  ) as request_id;
  $$
);