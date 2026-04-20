// Wrapper around supabase.functions.invoke that surfaces the JSON error body
// returned by the edge function (default invoke() throws a generic
// "Edge Function returned a non-2xx status code" without exposing the payload).
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type InvokeResult<T = any> = { data: T | null; error: Error | null };

export async function invokeFunction<T = any>(
  name: string,
  body: unknown,
): Promise<InvokeResult<T>> {
  const { data, error } = await supabase.functions.invoke(name, { body: body as any });
  if (!error) return { data: data as T, error: null };

  // Try to read the structured error body from the underlying Response.
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = await error.context.json();
      const detail =
        (payload && (payload.error || payload.message)) ||
        JSON.stringify(payload).slice(0, 300);
      return {
        data: null,
        error: new Error(`[${name}] ${detail}`),
      };
    } catch {
      try {
        const txt = await error.context.text();
        if (txt) return { data: null, error: new Error(`[${name}] ${txt.slice(0, 300)}`) };
      } catch {
        /* ignore */
      }
    }
  }

  return { data: null, error: new Error(`[${name}] ${error.message}`) };
}
