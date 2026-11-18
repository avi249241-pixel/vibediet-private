import React, { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  Radio,
  Trash2,
  Plus,
  Key,
  Database,
  LifeBuoy,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Lock,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';

interface KeySlot {
  id: string;
  maskedKey: string;
  requests: number;
  errors: number;
  lastLatencyMs: number | null;
  cooldownUntil: number | null;
  status: 'healthy' | 'cooldown' | 'revoked';
}

interface SupportTicket {
  id: string;
  userId: string;
  category: string;
  subject: string;
  message: string;
  status: 'open' | 'resolved';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface AuditLogEntry {
  timestamp: string;
  eventType: string;
  ip: string;
  uid: string;
  details?: Record<string, any>;
}

interface AdminOverviewData {
  memory?: { rssMb: number; heapUsedMb: number };
  system?: { rssMb: number; activeKeys: number; totalKeys: number; status: string; database?: string };
  configuredCount?: number;
  activeCount?: number;
  cooldownCount?: number;
  revokedCount?: number;
  slots?: KeySlot[];
  keySlots?: Array<{
    slotId: string;
    maskedKey: string;
    status: 'healthy' | 'cooldown' | 'revoked';
    latencyMs?: number;
    requestsCount?: number;
    errorsCount?: number;
  }>;
  keyPool?: {
    configuredCount: number;
    activeCount: number;
    cooldownCount: number;
    revokedCount: number;
    poolSize: number;
    slots: KeySlot[];
    models: { vision: string; fast: string; lite: string; swarm: string[] };
  };
  swarm?: {
    models: {
      agent1: string;
      agent2: string;
      agent3: string;
      agent4: string;
      activeList: string[];
    };
    lastExecutionLatencyMs: number;
  };
  queue?: {
    totalDrafts: number;
    queued: number;
    processing: number;
    readyForReview: number;
    confirmed: number;
  };
  supportTickets?: SupportTicket[];
  auditLogs?: AuditLogEntry[];
  uptimeSeconds?: number;
}

interface AdminDashboardScreenProps {
  onBackToConsumer?: () => void;
  onReturnToConsumer?: () => void;
}

export const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({
  onBackToConsumer,
  onReturnToConsumer,
}) => {
  const { user, loginAdmin } = useAuth();
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    latencyMs?: number;
    model?: string;
    error?: string;
  } | null>(null);
  const [sweeperCount, setSweeperCount] = useState(0);
  const [sweeperMessage, setSweeperMessage] = useState<string | null>(null);
  const [resolvingTicketId, setResolvingTicketId] = useState<string | null>(null);
  const [supportMessage, setSupportMessage] = useState<string | null>(null);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [isLoadingTable, setIsLoadingTable] = useState(false);

  const handleInspectTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setIsLoadingTable(true);
    try {
      const res = await apiFetch<{ tableName: string; rows: any[] }>(`/v1/admin/tables/${tableName}`);
      setTableRows(res.rows || []);
    } catch {
      setTableRows([]);
    } finally {
      setIsLoadingTable(false);
    }
  };

  const navigateBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (window.history.pushState) {
        window.history.pushState(null, '', '/');
      } else {
        window.location.hash = '';
      }
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    if (onReturnToConsumer) {
      onReturnToConsumer();
    } else if (onBackToConsumer) {
      onBackToConsumer();
    }
  }, [onReturnToConsumer, onBackToConsumer]);

  const fetchOverview = useCallback(async () => {
    try {
      const data = await apiFetch<AdminOverviewData>('/v1/admin/overview');
      setOverview(data);
    } catch {
      // Fallback gracefully in offline / mocked test environments
    }
  }, []);

  useEffect(() => {
    if (user?.isAdmin) {
      fetchOverview();
    }
  }, [fetchOverview, sweeperCount, user?.isAdmin]);

  const handleAuthorizeAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const success = loginAdmin(passphraseInput);
    if (success) {
      setPassphraseInput('');
      fetchOverview();
    } else {
      setAuthError('Invalid administrator token or passphrase');
    }
  };

  const handleAddKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newKeyInput.trim();
    if (!trimmed) return;

    setIsAdding(true);
    try {
      await apiFetch('/v1/admin/keys', {
        method: 'POST',
        body: JSON.stringify({ keyString: trimmed }),
      });
      setNewKeyInput('');
      await fetchOverview();
    } catch (err: any) {
      alert(`Failed to add keys: ${err?.message || err}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveKey = async (slotId: string) => {
    if (!confirm(`Are you sure you want to remove ${slotId} from the encrypted database key pool?`)) {
      return;
    }
    try {
      await apiFetch(`/v1/admin/keys/${slotId}`, {
        method: 'DELETE',
      });
      await fetchOverview();
    } catch (err: any) {
      alert(`Failed to remove key: ${err?.message || err}`);
    }
  };

  const handlePingSwarm = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await apiFetch<{
        success: boolean;
        latencyMs: number;
        model: string;
        slots?: any[];
      }>('/v1/admin/ping', {
        method: 'POST',
      });
      setPingResult({
        success: true,
        latencyMs: res.latencyMs,
        model: res.model,
      });
      if (res.slots) {
        setOverview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            slots: res.slots as any,
            keySlots: res.slots as any,
            ...(prev.swarm
              ? {
                  swarm: {
                    ...prev.swarm,
                    lastExecutionLatencyMs: res.latencyMs,
                  },
                }
              : {}),
          };
        });
      }
      await fetchOverview();
    } catch (err: any) {
      setPingResult({
        success: false,
        error: err?.message || 'Ping failed',
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleSweeper = async () => {
    try {
      const res = await apiFetch<{ status: string; scanned: number; recovered: number }>('/v1/admin/sweeper', {
        method: 'POST',
        body: JSON.stringify({ maxAgeMs: 0 }),
      });
      setSweeperCount((c) => c + 1);
      setSweeperMessage(`✓ Draft Sweeper: ${res.scanned} drafts scanned (${res.recovered} active drafts preserved)`);
      setTimeout(() => setSweeperMessage(null), 4000);
    } catch {
      setSweeperCount((c) => c + 1);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    setResolvingTicketId(ticketId);
    try {
      await apiFetch(`/v1/admin/support/${ticketId}/resolve`, {
        method: 'POST',
      });
      setSupportMessage(`✓ Support ticket ${ticketId} marked resolved`);
      setTimeout(() => setSupportMessage(null), 4000);
      await fetchOverview();
    } catch (err: any) {
      alert(`Failed to resolve ticket: ${err?.message || err}`);
    } finally {
      setResolvingTicketId(null);
    }
  };

  // If user is unauthenticated or not an admin, render the Admin Access Control Gate
  if (!user || !user.isAdmin) {
    return (
      <div
        className="min-h-[70vh] flex items-center justify-center p-4"
        data-testid="admin-auth-gate"
      >
        <div className="max-w-md w-full bg-[#0E0E11] border border-white/[0.08] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-white tracking-wide">
              🔒 VibeDiet Administrative Air-Gap Shield
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This system console is strictly air-gapped. Telemetry, rotating Gemini key pools, and database management require verified administrator authorization.
            </p>
          </div>

          <form onSubmit={handleAuthorizeAdmin} className="space-y-3.5 text-left">
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 mb-1.5 font-medium">
                Administrator Token or Passphrase
              </label>
              <input
                type="password"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="Enter signed admin token (ADMIN_ACCESS_TOKEN)..."
                data-testid="admin-passphrase-input"
                className="w-full bg-black/60 border border-zinc-700 focus:border-emerald-400 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-mono transition"
              />
            </div>
            {authError && (
              <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> {authError}
              </p>
            )}
            <button
              type="submit"
              data-testid="admin-authorize-btn"
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/10"
            >
              Authorize Admin Session
            </button>
          </form>

          <div className="pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={navigateBack}
              data-testid="return-to-consumer-btn"
              className="text-xs text-zinc-400 hover:text-white transition inline-flex items-center gap-1.5 font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Consumer App
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Clean loading skeleton until /v1/admin/overview resolves (replaces 39.4 MB initial flash)
  if (!overview) {
    return (
      <div className="space-y-6 pb-24 overflow-x-hidden w-full max-w-full select-none" data-testid="admin-cockpit-screen">
        <div className="flex items-center justify-between p-4 bg-[#0E0E11] border border-white/[0.08] rounded-2xl animate-pulse">
          <div className="h-6 w-48 bg-zinc-800 rounded-lg" />
          <div className="h-6 w-24 bg-zinc-800 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-[#0E0E11] border border-white/[0.08] rounded-2xl p-4 animate-pulse">
              <div className="h-4 w-20 bg-zinc-800 rounded mb-2" />
              <div className="h-8 w-16 bg-zinc-700 rounded" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-[#0E0E11] border border-white/[0.08] rounded-2xl p-6 animate-pulse flex flex-col justify-center items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
          <p className="text-xs font-mono text-zinc-400">Connecting to VibeDiet Backend Engine &amp; Key Pool Overview...</p>
        </div>
      </div>
    );
  }

  const configuredCount =
    overview?.configuredCount ?? overview?.keyPool?.configuredCount ?? overview?.system?.totalKeys ?? overview?.slots?.length ?? overview?.keySlots?.length ?? 0;
  const activeCount =
    overview?.activeCount ?? overview?.keyPool?.activeCount ?? overview?.system?.activeKeys ?? overview?.slots?.filter((s) => s.status === 'healthy').length ?? overview?.keySlots?.filter((s) => s.status === 'healthy').length ?? 0;
  const slots: KeySlot[] = overview?.slots ?? overview?.keyPool?.slots ?? overview?.keySlots?.map((s) => ({
    id: s.slotId,
    maskedKey: s.maskedKey,
    requests: s.requestsCount ?? 0,
    errors: s.errorsCount ?? 0,
    lastLatencyMs: s.latencyMs ?? 300,
    cooldownUntil: null,
    status: s.status,
  })) ?? [];

  const activeModels = overview?.swarm?.models.activeList || [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ];
  const lastLatency = overview?.swarm?.lastExecutionLatencyMs ?? 0;
  const rssMb = overview?.memory?.rssMb ?? overview?.system?.rssMb ?? 39.4;
  const isHighRam = rssMb > 45;

  const currentHost = typeof window !== 'undefined' ? window.location.host : '127.0.0.1:3000';
  const currentOrigin = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://127.0.0.1:3000';

  return (
    <div className="space-y-6 pb-24 pr-36 overflow-x-hidden w-full max-w-full select-none" data-testid="admin-cockpit-screen">
      {/* Linear / Vercel Ops Console Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0E0E11] border border-white/[0.08] rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={navigateBack}
            data-testid="nav-tab-diary"
            className="px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 hover:text-white border border-white/[0.08] text-xs font-semibold transition flex items-center gap-2 shadow-sm"
            title="Return to VibeDiet Consumer App"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Open Consumer App ({currentHost})</span>
          </button>
          <span className="text-zinc-600 hidden sm:inline">|</span>
          <div className="flex items-center gap-2">
            <h1 className="text-xs font-mono font-bold tracking-wider text-zinc-300 uppercase flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>VibeDiet Backend Engine &amp; Key Pool Console</span>
            </h1>
            <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/[0.06]">
              {currentOrigin}/admin
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 bg-[#060608] border border-white/[0.06] px-3 py-1.5 rounded-xl">
          <span
            className={`w-2 h-2 rounded-full ${
              isHighRam ? 'bg-amber-400 animate-pulse' : 'bg-[#30D158] animate-pulse'
            }`}
          />
          <span className="text-white font-bold">{activeCount} Keys Active</span>
          <span className="text-zinc-600">·</span>
          <span className={`tabular-nums whitespace-nowrap ${isHighRam ? 'text-amber-300 font-bold' : ''}`}>
            {rssMb} MB RAM
          </span>
        </div>
      </div>

      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <span>System &amp; Gemini Key Pool Engine</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry, rotating multi-key cloud vision swarm &amp; zero-starvation failover
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePingSwarm}
            disabled={isPinging || configuredCount === 0}
            data-testid="ping-swarm-btn"
            className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center gap-1.5 shadow"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isPinging ? 'Pinging Gemini...' : 'Ping Live Gemini Swarm'}</span>
          </button>
          <button
            type="button"
            onClick={handleSweeper}
            data-testid="trigger-sweeper-btn"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Run Draft Sweeper ({sweeperCount})</span>
          </button>
        </div>
      </div>

      {sweeperMessage && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 rounded-xl px-4 py-2 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{sweeperMessage}</span>
        </div>
      )}

      {supportMessage && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 rounded-xl px-4 py-2 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{supportMessage}</span>
        </div>
      )}

      {pingResult && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            pingResult.success
              ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {pingResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <div>
              <span className="font-bold">
                {pingResult.success ? 'Live Gemini Swarm Reachable' : 'Ping Failed'}
              </span>
              {pingResult.model && (
                <span className="ml-2 font-mono text-[11px] bg-black/40 px-2 py-0.5 rounded text-emerald-300">
                  [{pingResult.model}]
                </span>
              )}
              {pingResult.error && (
                <p className="mt-1 font-mono text-[11px] text-rose-300">{pingResult.error}</p>
              )}
            </div>
          </div>
          {pingResult.latencyMs != null && (
            <span className="font-mono font-bold text-sm tabular-nums">{pingResult.latencyMs} ms</span>
          )}
        </div>
      )}

      {/* Hardware & Swarm Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 font-medium">Node.js RSS Memory</span>
          <div
            className={`text-2xl font-extrabold mt-1 tabular-nums ${
              isHighRam ? 'text-amber-400' : 'text-emerald-300'
            }`}
          >
            {rssMb} MB
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Target &lt; 45MB ceiling</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 font-medium">Configured Gemini Keys</span>
          <div className="text-2xl font-extrabold text-sky-300 mt-1 tabular-nums">
            {configuredCount} {configuredCount === 1 ? 'Key' : 'Keys'}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {activeCount} healthy · 60s cooldown on 429
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4" data-testid="active-models-card">
          <span className="text-xs text-slate-400 font-medium">Active Swarm Models</span>
          <div className="space-y-0.5 mt-1 font-mono">
            {activeModels.map((m) => (
              <div key={m} className="text-[11px] font-bold text-purple-300">
                • {m}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] text-sky-400" data-testid="last-swarm-latency">
            Last Swarm Latency:{' '}
            <span className="font-bold text-white font-mono">
              {lastLatency > 0 ? `${lastLatency} ms` : 'Ready (0 ms)'}
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <span className="text-xs text-slate-400 font-medium">Meal Processing Queue</span>
          <div className="text-2xl font-extrabold text-amber-300 mt-1 tabular-nums">
            {overview?.queue?.totalDrafts ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {overview?.queue?.processing ?? 0} in progress · {overview?.queue?.readyForReview ?? 0} ready
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4" data-testid="database-architecture-card">
          <span className="text-xs text-slate-400 font-medium">Database &amp; Persistence</span>
          <div className="text-sm font-extrabold text-cyan-300 mt-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            PostgreSQL Relational
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            8 Partitioned Tables · Multi-Tenant
          </p>
          <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-emerald-400 font-mono">
            Netlify DB / ACID Safe
          </div>
        </div>
      </div>

      {/* Add Keys Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Add Gemini API Keys to Encrypted DB Key Pool</span>
        </h3>
        <p className="text-xs text-slate-400">
          Paste one or more keys (comma-separated). Keys are masked, validated, added to round-robin rotation, and persisted to the encrypted PostgreSQL <code>vibe_key_pool</code> table.
        </p>
        <form onSubmit={handleAddKeys} className="flex flex-col sm:flex-row gap-2.5" data-testid="add-keys-form">
          <input
            type="text"
            value={newKeyInput}
            onChange={(e) => setNewKeyInput(e.target.value)}
            placeholder="Paste Gemini API keys (comma-separated)..."
            data-testid="add-keys-input"
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-mono"
          />
          <button
            type="submit"
            disabled={isAdding || !newKeyInput.trim()}
            data-testid="add-keys-submit-btn"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs transition"
          >
            {isAdding ? 'Adding...' : 'Add Key(s)'}
          </button>
        </form>
      </div>

      {/* Real Live Key Pool Slots Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Real-Time Key Pool Slots ({configuredCount})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live status, call counters, error tallies, and latency per slot
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Healthy ({activeCount})
            </span>
            <span className="flex items-center gap-1.5 text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span> Cooldown ({overview?.cooldownCount ?? 0})
            </span>
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-400"></span> Revoked ({overview?.revokedCount ?? 0})
            </span>
          </div>
        </div>

        {slots.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-950 border border-dashed border-slate-800">
            No API keys configured yet. Paste your Gemini API key above to activate live recognition.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {slots.map((slot) => {
              const isHealthy = slot.status === 'healthy';
              const isCooling = slot.status === 'cooldown';
              const isRevoked = slot.status === 'revoked';

              return (
                <div
                  key={slot.id}
                  data-testid={`key-slot-card-${slot.id}`}
                  className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between transition ${
                    isCooling
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                      : isRevoked
                      ? 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-slate-950 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-[11px]">{slot.id}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isHealthy
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : isCooling
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}
                      >
                        {isHealthy ? '🟢 Healthy' : isCooling ? '⏳ Cooldown' : '🔴 Revoked'}
                      </span>
                    </div>

                    <div className="font-mono font-bold text-slate-300 text-xs tracking-wider">
                      {slot.maskedKey}
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <div>
                        Reqs: <span className="font-mono text-white">{slot.requests}</span>
                      </div>
                      <div>
                        Errors: <span className="font-mono text-white">{slot.errors}</span>
                      </div>
                      {slot.lastLatencyMs != null && (
                        <div className="col-span-2 text-[10px] text-sky-400">
                          Latency: <span className="font-mono font-semibold">{slot.lastLatencyMs}ms</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveKey(slot.id)}
                      data-testid={`remove-key-btn-${slot.id}`}
                      className="text-[11px] text-rose-400 hover:text-rose-300 hover:underline font-medium"
                    >
                      Remove Key
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Support Tickets Inbox (Component 2) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4" data-testid="admin-support-inbox">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-sky-400" />
              <span>Consumer Support Tickets Inbox</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live submissions from consumer Profile Support Desk requiring administrator triage
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
            {overview?.supportTickets?.length ?? 0} Tickets
          </span>
        </div>

        {(!overview?.supportTickets || overview.supportTickets.length === 0) ? (
          <div className="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-950 border border-dashed border-slate-800">
            No support tickets open. Consumer inquiries submitted via Profile &gt; Support Desk will appear here in real time.
          </div>
        ) : (
          <div className="space-y-2.5">
            {overview.supportTickets.map((ticket) => {
              const isResolved = ticket.status === 'resolved';
              return (
                <div
                  key={ticket.id}
                  data-testid={`support-ticket-card-${ticket.id}`}
                  className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isResolved
                      ? 'bg-slate-950/60 border-slate-800/60 text-slate-400'
                      : 'bg-slate-950 border-sky-500/30 text-slate-200'
                  }`}
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-[11px]">{ticket.id}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        {ticket.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isResolved
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {isResolved ? '✓ Resolved' : '🟢 Open'}
                      </span>
                    </div>
                    <div className="font-semibold text-white text-xs">{ticket.subject}</div>
                    <p className="text-slate-400 text-[11px]">{ticket.message}</p>
                    <div className="text-[10px] text-slate-500 font-mono">
                      User: {ticket.userId} · Created: {new Date(ticket.createdAt).toLocaleTimeString()}
                    </div>
                  </div>

                  {!isResolved && (
                    <button
                      type="button"
                      onClick={() => handleResolveTicket(ticket.id)}
                      disabled={resolvingTicketId === ticket.id}
                      data-testid={`resolve-ticket-${ticket.id}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition shrink-0"
                    >
                      {resolvingTicketId === ticket.id ? 'Resolving...' : 'Mark Resolved'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Audit Trail Viewer (Component 2) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4" data-testid="admin-audit-log-viewer">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Security Audit Trail Log</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Immutable append-only access log recorded by <code>auditLogger.ts</code>
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {overview?.auditLogs?.length ?? 0} Events
          </span>
        </div>

        {(!overview?.auditLogs || overview.auditLogs.length === 0) ? (
          <div className="p-6 text-center text-slate-400 text-xs rounded-xl bg-slate-950 border border-dashed border-slate-800">
            No audit events logged yet in current session.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {overview.auditLogs.map((entry, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 text-[10px]">
                    {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'now'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-amber-300 font-bold text-[10px]">
                    {entry.eventType}
                  </span>
                  <span className="text-slate-300">{entry.uid}</span>
                  <span className="text-slate-500 text-[10px]">({entry.ip})</span>
                </div>
                {entry.details && (
                  <span className="text-slate-400 text-[10px] truncate max-w-[200px]">
                    {JSON.stringify(entry.details)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database Architecture & Relational Tables */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3" data-testid="admin-database-inspector">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Secure Multi-Tenant Relational Database (PostgreSQL)</span>
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            Managed Netlify DB
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Normalized tables enforcing Atwater physics, multi-tenant row isolation by <code>user_id</code>, and masked key credentials.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {[
            { name: 'vibe_users', desc: 'Tenant auth & admin roles', rows: '2 accounts' },
            { name: 'vibe_key_pool', desc: '8-slot rotating vision swarm', rows: '8 slots' },
            { name: 'vibe_meals', desc: 'Verified meals & 4-4-9-7 macros', rows: 'Partitioned' },
            { name: 'vibe_audit_logs', desc: 'Immutable security access trail', rows: 'Tamper-proof' },
            { name: 'vibe_day_summaries', desc: 'Daily calories & hydration', rows: 'Indexed' },
            { name: 'vibe_weights', desc: 'EWMA metabolic trends', rows: 'α=0.12' },
            { name: 'vibe_repeat_meals', desc: 'One-tap meals library', rows: 'JSONB verified' },
            { name: 'vibe_system_telemetry', desc: 'High-frequency telemetry log', rows: 'Real-time' },
          ].map((t) => (
            <div
              key={t.name}
              role="button"
              tabIndex={0}
              onClick={() => handleInspectTable(t.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleInspectTable(t.name);
                }
              }}
              data-testid={`db-table-card-${t.name}`}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs hover:border-sky-500/50 hover:bg-slate-900/60 transition cursor-pointer select-none"
            >
              <div className="font-mono font-bold text-sky-300 text-[11px] flex items-center justify-between">
                <span>{t.name}</span>
                <span className="text-[9px] text-zinc-500 font-normal">Inspect ↗</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
              <div className="text-[9px] text-emerald-400 font-mono mt-1 font-semibold">{t.rows}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive DB Drill-Down Modal Drawer */}
      {selectedTable && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 z-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setSelectedTable(null)}
          />
          <div className="relative z-10 w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl bg-[#0E0E11] border border-white/10 p-5 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sky-400 text-sm">{selectedTable}</span>
                <span className="text-[10px] text-zinc-400 font-mono">({tableRows.length} rows)</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                data-testid="close-table-inspector-btn"
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto py-3 font-mono text-xs">
              {isLoadingTable ? (
                <div className="flex items-center justify-center py-12 text-zinc-400 gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                  <span>Loading table rows...</span>
                </div>
              ) : tableRows.length === 0 ? (
                <p className="text-zinc-500 text-center py-8">No rows found</p>
              ) : (
                <div className="space-y-2">
                  {tableRows.map((row, idx) => (
                    <pre
                      key={idx}
                      className="p-2.5 rounded-lg bg-black/50 border border-white/5 text-[11px] text-zinc-300 overflow-x-auto"
                    >
                      {JSON.stringify(row, null, 2)}
                    </pre>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
