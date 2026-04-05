'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type StepStatus = 'pending' | 'testing' | 'passed' | 'failed' | 'skipped';

interface LauncherStep {
  id: string;
  name: string;
  description: string;
  deps: string[];
  testInstructions: string;
  status: StepStatus;
  notes: string;
  output: string;
  duration: number | null;
}

interface StreamEvent {
  step: string;
  status: 'running' | 'done' | 'error';
  detail: string;
  ts: number;
}

const INITIAL_STEPS: LauncherStep[] = [
  {
    id: 'scaffold',
    name: '1. Scaffold',
    description: 'Create project directory, package.json, tsconfig, tailwind config, Next.js layout, global CSS, and placeholder assets',
    deps: [],
    testInstructions: 'Click "Test" to scaffold a test e-commerce project. Check that the output directory is created with proper structure.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'codegen',
    name: '2. Codegen',
    description: 'Generate page TSX code using AI (Claude Sonnet or local Qwen). Creates homepage, shop, product, about, contact pages.',
    deps: ['scaffold'],
    testInstructions: 'Requires scaffold. Click "Test" to generate pages. Verify TSX files are valid React components.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'integrations',
    name: '3. Integrations',
    description: 'Add payment (Stripe), database (Supabase), auth, analytics, email integrations to the scaffolded project.',
    deps: ['scaffold'],
    testInstructions: 'Click "Test" to add Medusa + Stripe integration. Check that lib files and env vars are generated.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'assets',
    name: '4. Assets',
    description: 'Generate images (logo, hero, product photos), videos, and 3D models using AI image generation.',
    deps: ['scaffold'],
    testInstructions: 'Click "Test" to generate logo + hero image. Verify PNG files are created in public/assets.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'install',
    name: '5. Install',
    description: 'Run npm install in the generated project directory. Installs all dependencies from package.json.',
    deps: ['codegen', 'integrations'],
    testInstructions: 'Click "Test" to run npm install. Verify node_modules is created and no errors.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'build-check',
    name: '6. Build Check',
    description: 'Run "npx next build" to verify the project compiles without errors.',
    deps: ['install'],
    testInstructions: 'Click "Test" to run build. Check for TypeScript errors, missing imports, etc.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'debug-fix',
    name: '7. Debug & Fix',
    description: 'If build fails, use AI to analyze errors and auto-fix them. Up to 10 retries.',
    deps: ['build-check'],
    testInstructions: 'Only runs if build failed. Click "Test" to attempt auto-fix. Verify errors are resolved.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'launch',
    name: '8. Launch',
    description: 'Start the Next.js dev server locally. Find available port and start "next dev".',
    deps: ['debug-fix', 'assets'],
    testInstructions: 'Click "Test" to launch dev server. Verify site loads in browser on the assigned port.',
    status: 'pending', notes: '', output: '', duration: null,
  },
  {
    id: 'deploy',
    name: '9. Deploy',
    description: 'Deploy to production — Docker container on GPU2 or Vercel. Push to git remote.',
    deps: ['launch'],
    testInstructions: 'Click "Test" to deploy. Verify the site is accessible on the production URL.',
    status: 'pending', notes: '', output: '', duration: null,
  },
];

const STATUS_STYLES: Record<StepStatus, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'bg-gray-100',   text: 'text-gray-600',   label: 'Pending' },
  testing:  { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Testing...' },
  passed:   { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Passed' },
  failed:   { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
  skipped:  { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Skipped' },
};

export default function LauncherValidationPage() {
  const [steps, setSteps] = useState<LauncherStep[]>(INITIAL_STEPS);
  const [testConfig, setTestConfig] = useState({
    projectName: 'LuxWatch Store',
    niche: 'luxury watches',
    outputDir: '~/Desktop/hearst-projects/test-luxwatch',
  });
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [fullPipelineLog, setFullPipelineLog] = useState<string[]>([]);

  // SSE streaming state
  const [streamLogs, setStreamLogs] = useState<StreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStepStatus, setStreamStepStatus] = useState<Record<string, 'running' | 'done' | 'error'>>({});
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const updateStep = useCallback((id: string, updates: Partial<LauncherStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const testStep = useCallback(async (stepId: string) => {
    updateStep(stepId, { status: 'testing', output: '', duration: null });
    const t0 = Date.now();

    try {
      const res = await fetch('/api/launcher/test-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          config: testConfig,
          jobId: activeJobId,
        }),
      });

      const data = await res.json();
      const duration = Date.now() - t0;

      if (data.success) {
        updateStep(stepId, {
          status: 'passed',
          output: data.output ?? 'Step completed successfully',
          duration,
        });
        if (data.jobId) setActiveJobId(data.jobId);
      } else {
        updateStep(stepId, {
          status: 'failed',
          output: data.error ?? 'Unknown error',
          duration,
        });
      }

      setFullPipelineLog(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ${stepId}: ${data.success ? 'PASSED' : 'FAILED'} (${(duration / 1000).toFixed(1)}s)`,
      ]);
    } catch (err) {
      const duration = Date.now() - t0;
      updateStep(stepId, {
        status: 'failed',
        output: err instanceof Error ? err.message : 'Network error',
        duration,
      });
    }
  }, [testConfig, activeJobId, updateStep]);

  const pipelineResultsRef = useRef<Record<string, boolean>>({});

  const runFullPipeline = useCallback(async () => {
    setFullPipelineLog([]);
    pipelineResultsRef.current = {};

    const stepIds = steps.filter(s => s.status !== 'skipped').map(s => s.id);
    for (const id of stepIds) {
      updateStep(id, { status: 'testing', output: '', duration: null });
      const t0 = Date.now();
      try {
        const res = await fetch('/api/launcher/test-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stepId: id, config: testConfig, jobId: activeJobId }),
        });
        const data = await res.json();
        const duration = Date.now() - t0;
        const passed = !!data.success;

        pipelineResultsRef.current[id] = passed;
        updateStep(id, {
          status: passed ? 'passed' : 'failed',
          output: data.output ?? data.error ?? 'Unknown',
          duration,
        });
        if (data.jobId) setActiveJobId(data.jobId);

        setFullPipelineLog(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${id}: ${passed ? 'PASSED' : 'FAILED'} (${(duration / 1000).toFixed(1)}s)`,
        ]);

        if (!passed) break;
      } catch (err) {
        const duration = Date.now() - t0;
        pipelineResultsRef.current[id] = false;
        updateStep(id, {
          status: 'failed',
          output: err instanceof Error ? err.message : 'Network error',
          duration,
        });
        setFullPipelineLog(prev => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ${id}: FAILED (${(duration / 1000).toFixed(1)}s)`,
        ]);
        break;
      }
    }
  }, [steps, testConfig, activeJobId, updateStep]);

  const setManualStatus = useCallback((id: string, status: StepStatus) => {
    updateStep(id, { status });
  }, [updateStep]);

  const resetAll = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setActiveJobId(null);
    setFullPipelineLog([]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [streamLogs]);

  const runWithStream = useCallback(async () => {
    abortRef.current?.abort();
    setStreamLogs([]);
    setStreamStepStatus({});
    setIsStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/launcher/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: testConfig }),
        signal: ctrl.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt: StreamEvent = JSON.parse(line.slice(6));
            setStreamLogs(prev => [...prev, evt]);
            setStreamStepStatus(prev => ({ ...prev, [evt.step]: evt.status }));
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStreamLogs(prev => [...prev, { step: 'error', status: 'error', detail: (err as Error).message, ts: Date.now() }]);
      }
    }

    setIsStreaming(false);
  }, [testConfig]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const passedCount = steps.filter(s => s.status === 'passed').length;
  const failedCount = steps.filter(s => s.status === 'failed').length;
  const progress = Math.round((passedCount / steps.length) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Launcher Validation</h2>
          <p className="text-sm text-gray-500">Test each step of the project-launcher pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            Reset All
          </button>
          <button
            onClick={runFullPipeline}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Run Full Pipeline
          </button>
          {isStreaming ? (
            <button
              onClick={stopStream}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Stop Stream
            </button>
          ) : (
            <button
              onClick={runWithStream}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Run with Live Logs
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress: {passedCount}/{steps.length} steps</span>
          <span className="text-gray-500">
            {passedCount > 0 && <span className="text-green-600">{passedCount} passed</span>}
            {failedCount > 0 && <span className="ml-2 text-red-600">{failedCount} failed</span>}
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-gray-100">
          <div
            className="h-2 rounded-full bg-green-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Test config */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Test Configuration</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500">Project Name</label>
            <input
              value={testConfig.projectName}
              onChange={e => setTestConfig(p => ({ ...p, projectName: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Niche</label>
            <input
              value={testConfig.niche}
              onChange={e => setTestConfig(p => ({ ...p, niche: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500">Output Dir</label>
            <input
              value={testConfig.outputDir}
              onChange={e => setTestConfig(p => ({ ...p, outputDir: e.target.value }))}
              className="mt-1 w-full rounded-lg border px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const style = STATUS_STYLES[step.status];
          const depsReady = step.deps.every(depId => {
            const dep = steps.find(s => s.id === depId);
            return dep?.status === 'passed' || dep?.status === 'skipped';
          });
          const canTest = step.status !== 'testing' && (step.deps.length === 0 || depsReady);

          return (
            <div key={step.id} className={`rounded-xl border bg-white shadow-sm transition ${step.status === 'testing' ? 'ring-2 ring-blue-300' : ''}`}>
              <div className="flex items-start gap-4 p-5">
                {/* Step number */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  step.status === 'passed' ? 'bg-green-100 text-green-700' :
                  step.status === 'failed' ? 'bg-red-100 text-red-700' :
                  step.status === 'testing' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {step.status === 'passed' ? '✓' :
                   step.status === 'failed' ? '✗' :
                   step.status === 'testing' ? '⟳' :
                   idx + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{step.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
                      {style.label}
                    </span>
                    {step.duration !== null && (
                      <span className="text-xs text-gray-400">{(step.duration / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{step.description}</p>

                  {step.deps.length > 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      Depends on: {step.deps.join(', ')}
                      {!depsReady && <span className="ml-1 text-yellow-600">(waiting)</span>}
                    </p>
                  )}

                  {step.output && (
                    <pre className={`mt-2 max-h-40 overflow-auto rounded-lg p-3 text-xs ${
                      step.status === 'failed' ? 'bg-red-50 text-red-800' : 'bg-gray-50 text-gray-700'
                    }`}>
                      {step.output}
                    </pre>
                  )}

                  {/* Notes */}
                  <input
                    placeholder="Add notes..."
                    value={step.notes}
                    onChange={e => updateStep(step.id, { notes: e.target.value })}
                    className="mt-2 w-full rounded-lg border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-600 placeholder:text-gray-400 focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
                  />
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-col gap-1.5">
                  <button
                    onClick={() => testStep(step.id)}
                    disabled={!canTest}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {step.status === 'testing' ? 'Testing...' : 'Test'}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setManualStatus(step.id, 'passed')}
                      className="rounded border px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50"
                      title="Mark as passed"
                    >✓</button>
                    <button
                      onClick={() => setManualStatus(step.id, 'failed')}
                      className="rounded border px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                      title="Mark as failed"
                    >✗</button>
                    <button
                      onClick={() => setManualStatus(step.id, 'skipped')}
                      className="rounded border px-1.5 py-0.5 text-xs text-yellow-600 hover:bg-yellow-50"
                      title="Skip"
                    >—</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log */}
      {fullPipelineLog.length > 0 && (
        <div className="rounded-xl border bg-gray-900 p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-gray-300">Pipeline Log</h3>
          <pre className="max-h-60 overflow-auto text-xs text-green-400">
            {fullPipelineLog.join('\n')}
          </pre>
        </div>
      )}

      {/* Live Stream Panel */}
      {(streamLogs.length > 0 || isStreaming) && (
        <div className="rounded-xl border border-gray-700 bg-gray-950 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-200">Live Pipeline Logs</h3>
              {isStreaming && (
                <span className="flex items-center gap-1.5 rounded-full bg-green-900/40 px-2.5 py-0.5 text-xs text-green-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  Streaming
                </span>
              )}
            </div>
            {/* Step status pills */}
            <div className="flex gap-1.5">
              {Object.entries(streamStepStatus).filter(([k]) => k !== 'pipeline').map(([step, st]) => (
                <span key={step} className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  st === 'done' ? 'bg-green-900/40 text-green-400' :
                  st === 'error' ? 'bg-red-900/40 text-red-400' :
                  'bg-blue-900/40 text-blue-400'
                }`}>{step}</span>
              ))}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg bg-black/50 p-3 font-mono text-xs leading-relaxed">
            {streamLogs.map((evt, i) => {
              const time = new Date(evt.ts).toLocaleTimeString();
              let color = 'text-gray-400';
              if (evt.status === 'done') color = 'text-green-400';
              else if (evt.status === 'error') color = 'text-red-400';
              else if (evt.detail.includes('AI generated') || evt.detail.includes('Qwen')) color = 'text-purple-400';
              else if (evt.detail.includes('GPU')) color = 'text-cyan-400';
              return (
                <div key={i} className={color}>
                  <span className="text-gray-600">[{time}]</span>{' '}
                  <span className="text-yellow-500/80">{evt.step}</span>{' '}
                  {evt.detail}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
          {!isStreaming && streamLogs.length > 0 && (
            <div className="mt-2 text-right">
              <button onClick={() => setStreamLogs([])} className="text-xs text-gray-500 hover:text-gray-300">
                Clear logs
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
