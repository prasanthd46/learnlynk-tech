// LearnLynk Tech Test - Task 3: Edge Function create-task

// Deno + Supabase Edge Functions style
// Docs reference: https://supabase.com/docs/guides/functions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type CreateTaskPayload = {
  application_id: string;
  task_type: string;
  due_at: string;
};

const VALID_TYPES = ["call", "email", "review"];

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as Partial<CreateTaskPayload>;
    const { application_id, task_type, due_at } = body;

    // TODO: validate application_id, task_type, due_at
    // - check task_type in VALID_TYPES
    // - parse due_at and ensure it's in the future

    if (!application_id || !task_type || !due_at) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: application_id, task_type, due_at" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!VALID_TYPES.includes(task_type)) {
      return new Response(
        JSON.stringify({ error: `Invalid task_type. Must be one of: ${VALID_TYPES.join(', ')}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    const dueDate = new Date(due_at);
    const now = new Date();
    if (isNaN(dueDate.getTime()) || dueDate <= now) {
      return new Response(
        JSON.stringify({ error: "due_at must be a valid future timestamp." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }


    // TODO: insert into tasks table using supabase client

    // Example:
    // const { data, error } = await supabase
    //   .from("tasks")
    //   .insert({ ... })
    //   .select()
    //   .single();
    const { data: appData, error: appError } = await supabase
      .from("applications")
      .select("tenant_id")
      .eq("id", application_id)
      .single();

    if (appError || !appData) {
      return new Response(
        JSON.stringify({ error: "Application not found or invalid ID." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        tenant_id: appData.tenant_id,
        application_id: application_id,
        type: task_type, // Map 'task_type' input to 'type' column
        due_at: due_at,
        status: "open",
        title: `${task_type} task` // Optional: provide a default title
      })
      .select()
      .single();

    if (error) {
      console.error("Insert Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create task." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    // TODO: handle error and return appropriate status code

    // Example successful response:
    // return new Response(JSON.stringify({ success: true, task_id: data.id }), {
    //   status: 200,
    //   headers: { "Content-Type": "application/json" },
    // });
    await new Promise<void>((resolve) => {
      const channel = supabase.channel('task.created');
      
      channel.subscribe(async (status) => {
        
        if (status === 'SUBSCRIBED') {
          await channel.send({
            type: 'broadcast',
            event: 'task.created',
            payload: { task_id: data.id, application_id, task_type },
          });
          
          
          supabase.removeChannel(channel);
          resolve();
        }
      });
    });

    return new Response(
      JSON.stringify({ success: true, task_id: data.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
