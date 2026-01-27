import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Warming scheduler checking for scheduled sessions...");

  try {
    const now = new Date();
    const currentDay = now.getDay(); // 0=Sun, 1=Mon, etc.

    // Find sessions that should start now
    const { data: scheduledSessions, error } = await supabase
      .from('warming_sessions')
      .select('*')
      .eq('status', 'scheduled')
      .eq('schedule_enabled', true)
      .lte('scheduled_start_time', now.toISOString());

    if (error) {
      console.error("Error fetching scheduled sessions:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!scheduledSessions || scheduledSessions.length === 0) {
      console.log("No sessions scheduled for now");
      return new Response(JSON.stringify({ message: "No scheduled sessions", count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let startedCount = 0;
    const results: { sessionId: string; started: boolean; reason?: string }[] = [];

    for (const session of scheduledSessions) {
      // Check if session should run on current day (for weekly recurrence)
      if (session.schedule_recurrence === 'weekly') {
        const scheduleDays = session.schedule_days || [];
        if (!scheduleDays.includes(currentDay)) {
          console.log(`Session ${session.id} not scheduled for day ${currentDay}`);
          
          // Update scheduled time to next occurrence
          const nextScheduledTime = calculateNextScheduledTime(
            session.scheduled_start_time,
            session.schedule_recurrence,
            scheduleDays
          );
          
          await supabase
            .from('warming_sessions')
            .update({ scheduled_start_time: nextScheduledTime })
            .eq('id', session.id);
            
          results.push({ sessionId: session.id, started: false, reason: 'Not scheduled for today' });
          continue;
        }
      }

      // Start the warming session
      console.log(`Starting scheduled session: ${session.id}`);
      
      const { error: invokeError } = await supabase.functions.invoke('warming-worker', {
        body: { 
          action: 'start', 
          session_id: session.id,
          user_id: session.user_id
        }
      });

      if (invokeError) {
        console.error(`Failed to start session ${session.id}:`, invokeError);
        results.push({ sessionId: session.id, started: false, reason: invokeError.message });
        continue;
      }

      // Update status to running and set next scheduled time if recurring
      const updates: Record<string, unknown> = { 
        status: 'running',
        started_at: now.toISOString()
      };

      if (session.schedule_recurrence !== 'none') {
        updates.scheduled_start_time = calculateNextScheduledTime(
          session.scheduled_start_time,
          session.schedule_recurrence,
          session.schedule_days || []
        );
      } else {
        updates.schedule_enabled = false;
      }

      await supabase
        .from('warming_sessions')
        .update(updates)
        .eq('id', session.id);

      startedCount++;
      results.push({ sessionId: session.id, started: true });
    }

    console.log(`Started ${startedCount} scheduled sessions`);

    return new Response(JSON.stringify({ 
      message: `Started ${startedCount} sessions`,
      count: startedCount,
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scheduler error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calculateNextScheduledTime(
  currentScheduledTime: string,
  recurrence: string,
  scheduleDays: number[]
): string {
  const current = new Date(currentScheduledTime);
  const next = new Date(current);
  
  if (recurrence === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (recurrence === 'weekly' && scheduleDays.length > 0) {
    // Find the next scheduled day
    const currentDay = current.getDay();
    const sortedDays = [...scheduleDays].sort((a, b) => a - b);
    
    // Find next day after current
    let nextDay = sortedDays.find(d => d > currentDay);
    
    if (nextDay !== undefined) {
      // Same week
      next.setDate(next.getDate() + (nextDay - currentDay));
    } else {
      // Next week
      nextDay = sortedDays[0];
      next.setDate(next.getDate() + (7 - currentDay + nextDay));
    }
  } else {
    // Default: next day
    next.setDate(next.getDate() + 1);
  }
  
  return next.toISOString();
}
