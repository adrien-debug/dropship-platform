import type { SupabaseClient } from '@supabase/supabase-js';

export class JobTracker {
  private jobId: string | null = null;
  private sequence = 0;
  private stepStartMs: number = Date.now();

  constructor(private readonly supabase: SupabaseClient) {}

  async createJob(
    type: string,
    source: string,
    input: Record<string, unknown>,
  ): Promise<string> {
    const { data, error } = await this.supabase
      .from('jobs')
      .insert({ type, source, input, status: 'queued' })
      .select('id')
      .single();

    if (error) throw new Error(`JobTracker.createJob failed: ${error.message}`);
    this.jobId = data.id as string;
    return this.jobId;
  }

  async startJob(): Promise<void> {
    if (!this.jobId) return;
    const { error } = await this.supabase
      .from('jobs')
      .update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', this.jobId);
    if (error) console.error('[JobTracker] startJob failed:', error.message);
  }

  async event(
    step: string,
    status: string,
    message?: string,
    payload?: Record<string, unknown>,
    progress?: number,
  ): Promise<void> {
    if (!this.jobId) return;
    const now = Date.now();
    const duration_ms = now - this.stepStartMs;
    this.stepStartMs = now;
    this.sequence += 1;

    const { error } = await this.supabase.from('job_events').insert({
      job_id: this.jobId,
      step,
      status,
      message: message ?? null,
      payload: payload ?? {},
      progress: progress ?? null,
      duration_ms,
      sequence: this.sequence,
    });
    if (error) console.error('[JobTracker] event insert failed:', error.message);
  }

  async updateStep(step: string, progress: number): Promise<void> {
    if (!this.jobId) return;
    const { error } = await this.supabase
      .from('jobs')
      .update({ current_step: step, progress, updated_at: new Date().toISOString() })
      .eq('id', this.jobId);
    if (error) console.error('[JobTracker] updateStep failed:', error.message);
  }

  async completeJob(result: Record<string, unknown>): Promise<void> {
    if (!this.jobId) return;
    const { error } = await this.supabase
      .from('jobs')
      .update({
        status: 'succeeded',
        result,
        finished_at: new Date().toISOString(),
        progress: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);
    if (error) console.error('[JobTracker] completeJob failed:', error.message);
  }

  async failJob(errorMessage: string): Promise<void> {
    if (!this.jobId) return;
    const { error } = await this.supabase
      .from('jobs')
      .update({
        status: 'failed',
        error_message: errorMessage,
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', this.jobId);
    if (error) console.error('[JobTracker] failJob failed:', error.message);
  }

  getJobId(): string | null {
    return this.jobId;
  }
}
