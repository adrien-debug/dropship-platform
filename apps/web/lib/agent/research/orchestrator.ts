/**
 * Main loop / orchestrator for the research copilot.
 *
 * Split from `research-copilot.ts` for maintainability. The public surface
 * (`createResearchSession`, `runResearchTurn`, `RESEARCH_MODEL`) is
 * re-exported via `lib/agent/research-copilot.ts`.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { trackedMessage } from '../anthropic';
import { runContext } from '../run-context';
import { rebuildMessages, stringifyToolOutput } from '../copilot-shared';
import { TOOLS } from './tools';
import { buildSystemPrompt } from './prompts';
import { executeTool } from './executors';
import type { ResearchStreamEvent, ShortlistPayload } from './types';

// Niche research is the most strategic step in the pipeline — the choice of
// niche dictates everything downstream (visuals, copy, ad angles). We run
// the research loop on Opus 4.7 (vs Sonnet on the other modes) so the
// reasoning and the shortlist quality are as strong as we can get them.
// Bounded by MAX_TOOL_LOOPS so a single research session stays under ~$1.
export const RESEARCH_MODEL = 'claude-opus-4-7';
const MAX_TOOL_LOOPS = 6;
const MAX_TOOLS_PER_TURN = 8;

// ── DB helpers ─────────────────────────────────────────────────────────

export async function loadHistory(sessionId: string) {
  const db = getDb();
  const { rows } = await db.query<
    import('../copilot-shared').StoredMessage
  >(
    `SELECT id, role, content, tool_name, tool_input, tool_output, created_at
       FROM dropship_research_messages
       WHERE session_id = $1
       ORDER BY created_at ASC, id ASC`,
    [sessionId],
  );
  return rows;
}

export async function insertMessage(
  sessionId: string,
  msg: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolName?: string | null;
    toolInput?: unknown;
    toolOutput?: unknown;
  },
): Promise<void> {
  const db = getDb();
  await db.query(
    `INSERT INTO dropship_research_messages
       (session_id, role, content, tool_name, tool_input, tool_output)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      sessionId,
      msg.role,
      msg.content,
      msg.toolName ?? null,
      msg.toolInput == null ? null : JSON.stringify(msg.toolInput),
      msg.toolOutput == null ? null : JSON.stringify(msg.toolOutput),
    ],
  );
  await db.query(
    `UPDATE dropship_research_sessions SET updated_at = now() WHERE id = $1`,
    [sessionId],
  );
}

async function maybeBackfillTitle(sessionId: string, firstUserMessage: string): Promise<void> {
  const db = getDb();
  const { rows } = await db.query<{ title: string | null }>(
    `SELECT title FROM dropship_research_sessions WHERE id = $1 LIMIT 1`,
    [sessionId],
  );
  if (rows[0]?.title) return;
  const title = firstUserMessage.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!title) return;
  await db.query(
    `UPDATE dropship_research_sessions SET title = $1 WHERE id = $2 AND title IS NULL`,
    [title, sessionId],
  );
}

// ── Public entry points ────────────────────────────────────────────────

/**
 * Create a research session. Optional title (rarely set up-front; the
 * first user message backfills it on send).
 */
export async function createResearchSession(title?: string): Promise<string> {
  const db = getDb();
  const { rows } = await db.query<{ id: string }>(
    `INSERT INTO dropship_research_sessions (title) VALUES ($1) RETURNING id`,
    [title?.slice(0, 80) ?? null],
  );
  return rows[0]!.id;
}

/**
 * Stream a single chat turn. Each yielded event is JSON-serializable so
 * the SSE route can pass it straight to the wire. Same generator pattern
 * as curation-copilot — buffered event queue + worker promise.
 */
export async function* runResearchTurn(
  sessionId: string,
  userMessage: string,
): AsyncGenerator<ResearchStreamEvent> {
  const events: ResearchStreamEvent[] = [];
  let resolveNext: (() => void) | null = null;
  let runDone = false;

  const emit = (e: ResearchStreamEvent) => {
    events.push(e);
    if (resolveNext) {
      const r = resolveNext;
      resolveNext = null;
      r();
    }
  };

  const run = async () => {
    try {
      // Persist the user message first so a mid-turn crash still leaves a
      // queryable history.
      await insertMessage(sessionId, { role: 'user', content: userMessage });
      await maybeBackfillTitle(sessionId, userMessage);

      const history = await loadHistory(sessionId);
      const messages = rebuildMessages(history);

      // storeId is null on purpose: the store doesn't exist yet.
      await runContext.run({ storeId: null }, async () => {
        let loops = 0;
        let toolCallsThisTurn = 0;
        let finalAssistantText = '';

        while (loops < MAX_TOOL_LOOPS) {
          loops++;

          const response = await trackedMessage(
            { step: 'research-turn', storeId: null },
            {
              model: RESEARCH_MODEL,
              max_tokens: 4096,
              system: buildSystemPrompt(),
              tools: TOOLS,
              messages,
            },
          );

          const textBlocks = response.content.filter(
            (b) => b.type === 'text',
          ) as Array<Extract<typeof response.content[number], { type: 'text' }>>;
          const toolUseBlocks = response.content.filter(
            (b) => b.type === 'tool_use',
          ) as Array<Extract<typeof response.content[number], { type: 'tool_use' }>>;
          const assistantText = textBlocks.map((b) => b.text).join('\n').trim();

          if (assistantText) {
            emit({ type: 'thinking', data: { text: assistantText } });
            finalAssistantText = assistantText;
          }

          messages.push({
            role: 'assistant',
            content: response.content
              .filter((b) => b.type === 'text' || b.type === 'tool_use')
              .map((b) => {
                if (b.type === 'text') return { type: 'text', text: b.text };
                return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
              }) as Anthropic.Messages.ContentBlockParam[],
          });

          if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
            await insertMessage(sessionId, {
              role: 'assistant',
              content: finalAssistantText,
            });
            emit({ type: 'message', data: { text: finalAssistantText } });
            emit({ type: 'done', data: { text: finalAssistantText } });
            return;
          }

          if (assistantText) {
            await insertMessage(sessionId, {
              role: 'assistant',
              content: assistantText,
            });
          }

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
          for (const block of toolUseBlocks) {
            if (toolCallsThisTurn >= MAX_TOOLS_PER_TURN) {
              const msg = `Maximum d'appels d'outils par tour atteint (${MAX_TOOLS_PER_TURN}).`;
              await insertMessage(sessionId, {
                role: 'tool',
                content: msg,
                toolName: block.name,
                toolInput: { __tool_use_id: block.id, ...(block.input as object) },
                toolOutput: { error: msg },
              });
              toolResults.push({
                type: 'tool_result',
                tool_use_id: block.id,
                content: msg,
                is_error: true,
              });
              continue;
            }
            toolCallsThisTurn++;

            emit({
              type: 'tool_call',
              data: { id: block.id, name: block.name, input: block.input },
            });

            let toolOutput: unknown;
            let summary = '';
            let isError = false;
            let shortlist: ShortlistPayload | undefined;
            try {
              const result = await executeTool(block.name, block.input);
              toolOutput = result.output;
              summary = result.summary;
              shortlist = result.shortlist;
            } catch (e) {
              isError = true;
              const message = e instanceof Error ? e.message : String(e);
              const zodIssues =
                e instanceof z.ZodError
                  ? e.errors.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
                  : null;
              toolOutput = {
                error: message,
                ...(zodIssues ? { issues: zodIssues } : {}),
              };
              summary = `Erreur: ${message}`;
            }

            await insertMessage(sessionId, {
              role: 'tool',
              content: summary,
              toolName: block.name,
              toolInput: { __tool_use_id: block.id, ...(block.input as object) },
              toolOutput,
            });

            emit({
              type: 'tool_result',
              data: {
                id: block.id,
                name: block.name,
                output: toolOutput,
                summary,
                is_error: isError,
              },
            });

            if (shortlist) {
              emit({ type: 'shortlist', data: shortlist });
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: stringifyToolOutput(toolOutput),
              is_error: isError,
            });
          }

          messages.push({ role: 'user', content: toolResults });
        }

        const calledTools = [
          ...new Set(
            messages
              .flatMap((m) => (Array.isArray(m.content) ? m.content : []))
              .filter((b) => b.type === 'tool_use')
              .map((b) => (b as { type: 'tool_use'; name: string }).name),
          ),
        ];
        const guardMsg = [
          `Limite d'analyse atteinte (${MAX_TOOL_LOOPS} tours).`,
          calledTools.length
            ? `Étapes complétées : ${calledTools.join(', ')}.`
            : 'Aucune étape complétée.',
          'Envoie un nouveau message pour continuer.',
        ].join(' ');
        await insertMessage(sessionId, { role: 'assistant', content: guardMsg });
        emit({ type: 'message', data: { text: guardMsg } });
        emit({ type: 'done', data: { text: guardMsg } });
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      emit({ type: 'error', data: { message } });
    } finally {
      runDone = true;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r();
      }
    }
  };

  void run();

  while (true) {
    if (events.length > 0) {
      yield events.shift()!;
    } else if (runDone) {
      return;
    } else {
      await new Promise<void>((resolve) => {
        resolveNext = resolve;
      });
    }
  }
}
