import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Status scheduler: Starting execution...');

    // Find pending schedules that are due
    const now = new Date().toISOString();
    const { data: dueSchedules, error: fetchError } = await supabase
      .from('status_schedules')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now);

    if (fetchError) {
      console.error('Error fetching due schedules:', fetchError);
      throw fetchError;
    }

    if (!dueSchedules || dueSchedules.length === 0) {
      console.log('Status scheduler: No pending schedules due');
      return new Response(
        JSON.stringify({ message: 'No pending schedules', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Status scheduler: Found ${dueSchedules.length} due schedule(s)`);

    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const schedule of dueSchedules) {
      try {
        console.log(`Processing schedule ${schedule.id}...`);

        // Get instance keys for the schedule's instances
        const { data: instancesData, error: instancesError } = await supabase
          .from('whatsapp_instances')
          .select('id, instance_key, instance_name')
          .in('id', schedule.instance_ids);

        if (instancesError) {
          console.error(`Error fetching instances for schedule ${schedule.id}:`, instancesError);
          throw instancesError;
        }

        if (!instancesData || instancesData.length === 0) {
          console.warn(`No instances found for schedule ${schedule.id}`);
          await supabase
            .from('status_schedules')
            .update({ 
              status: 'failed', 
              error_message: 'No instances found',
              sent_at: now
            })
            .eq('id', schedule.id);
          errorCount++;
          continue;
        }

        let scheduleSuccessCount = 0;
        let scheduleFailCount = 0;

        // Send status to each instance
        for (const instance of instancesData) {
          if (!instance.instance_key) {
            console.warn(`Instance ${instance.instance_name} has no instance_key`);
            scheduleFailCount++;
            continue;
          }

          // Prepare payload for send-whatsapp-status
          const payload = {
            instanceKey: instance.instance_key,
            type: schedule.status_type,
            text: schedule.status_type === 'text' ? schedule.text_content : undefined,
            backgroundColor: schedule.background_color,
            font: schedule.font_style,
            file: schedule.media_url || undefined,
            mimetype: schedule.media_mimetype || undefined,
            caption: schedule.status_type !== 'text' && schedule.status_type !== 'audio' 
              ? schedule.text_content 
              : undefined,
          };

          console.log(`Sending status to instance ${instance.instance_name}...`);

          // Call the send-whatsapp-status function
          const { data, error } = await supabase.functions.invoke('send-whatsapp-status', {
            body: payload
          });

          if (error || data?.error) {
            console.error(`Error sending to ${instance.instance_name}:`, error || data?.error);
            scheduleFailCount++;
          } else {
            console.log(`Status sent successfully to ${instance.instance_name}`);
            scheduleSuccessCount++;
          }
        }

        // Update schedule status
        const finalStatus = scheduleSuccessCount > 0 ? 'sent' : 'failed';
        await supabase
          .from('status_schedules')
          .update({ 
            status: finalStatus,
            sent_at: now,
            success_count: scheduleSuccessCount,
            fail_count: scheduleFailCount,
            error_message: scheduleFailCount > 0 
              ? `Failed to send to ${scheduleFailCount} instance(s)` 
              : null
          })
          .eq('id', schedule.id);

        // Handle recurrence - create next schedule if needed
        if (schedule.recurrence_type !== 'none' && scheduleSuccessCount > 0) {
          const nextScheduledAt = calculateNextSchedule(
            schedule.scheduled_at,
            schedule.recurrence_type,
            schedule.recurrence_days,
            schedule.recurrence_end_date
          );

          if (nextScheduledAt) {
            console.log(`Creating next recurrent schedule for ${schedule.id}...`);
            await supabase
              .from('status_schedules')
              .insert({
                user_id: schedule.user_id,
                status_type: schedule.status_type,
                text_content: schedule.text_content,
                background_color: schedule.background_color,
                font_style: schedule.font_style,
                media_url: schedule.media_url,
                media_mimetype: schedule.media_mimetype,
                instance_ids: schedule.instance_ids,
                scheduled_at: nextScheduledAt,
                recurrence_type: schedule.recurrence_type,
                recurrence_days: schedule.recurrence_days,
                recurrence_end_date: schedule.recurrence_end_date,
              });
          }
        }

        processedCount++;
        if (scheduleSuccessCount > 0) successCount++;
        else errorCount++;

      } catch (scheduleError) {
        const errorMessage = scheduleError instanceof Error ? scheduleError.message : 'Unknown error';
        console.error(`Error processing schedule ${schedule.id}:`, scheduleError);
        await supabase
          .from('status_schedules')
          .update({ 
            status: 'failed', 
            error_message: errorMessage,
            sent_at: now
          })
          .eq('id', schedule.id);
        errorCount++;
      }
    }

    console.log(`Status scheduler: Completed. Processed: ${processedCount}, Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        message: 'Scheduler completed',
        processed: processedCount,
        success: successCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Status scheduler error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateNextSchedule(
  currentScheduledAt: string,
  recurrenceType: string,
  recurrenceDays: number[] | null,
  recurrenceEndDate: string | null
): string | null {
  const current = new Date(currentScheduledAt);
  let next: Date;

  if (recurrenceType === 'daily') {
    next = new Date(current);
    next.setDate(next.getDate() + 1);
  } else if (recurrenceType === 'weekly' && recurrenceDays && recurrenceDays.length > 0) {
    // Find next occurrence based on selected days
    next = new Date(current);
    let found = false;
    for (let i = 1; i <= 7; i++) {
      next.setDate(current.getDate() + i);
      if (recurrenceDays.includes(next.getDay())) {
        found = true;
        break;
      }
    }
    if (!found) return null;
  } else {
    return null;
  }

  // Check if next schedule is before end date
  if (recurrenceEndDate) {
    const endDate = new Date(recurrenceEndDate);
    if (next > endDate) {
      return null;
    }
  }

  return next.toISOString();
}
