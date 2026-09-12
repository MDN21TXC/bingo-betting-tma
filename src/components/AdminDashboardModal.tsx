import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Users,
  ArrowDownToLine,
  ArrowUpFromLine,
  Receipt,
  Gamepad2,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  DollarSign,
  UserCheck,
  UserX,
  Clock,
  ChevronRight
} from 'lucide-react';
import {
  UserAccount,
  DepositRequest,
  WithdrawalRequest,
  AuditLogRecord,
  LedgerEntry,
  AdminUserDetail,
  RoomSummary
} from '../types/bingo.js';
import { soundService } from '../services/soundService.js';
import { telegramSdk } from '../services/telegramSdk.js';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken?: string | null;
  token?: string | null;
  user?: UserAccount | null;
}

type AdminTab = 'users' | 'deposits' | 'withdrawals' | 'transactions' | 'games' | 'audit_logs';

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  sessionToken,
  token: propToken,
  user
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data Collections
  const [users, setUsers] = useState<AdminUserDetail[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Manual Adjustment Form
  const [adjustTargetId, setAdjustTargetId] = useState<string>('');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  const token = propToken || sessionToken || localStorage.getItem('bingo_auth_token');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
  };

  useEffect(() => {
    if (isOpen) {
      loadTabData(activeTab);
    }
  }, [isOpen, activeTab]);

  const loadTabData = async (tab: AdminTab) => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'users') {
        const res = await fetch('/api/admin/users', { headers: authHeaders });
        if (!res.ok) throw new Error('Failed to load users');
        const d = await res.json();
        setUsers(d.users || []);
      } else if (tab === 'deposits') {
        const res = await fetch('/api/admin/deposits', { headers: authHeaders });
        if (!res.ok) throw new Error('Failed to load deposits');
        const d = await res.json();
        setDeposits(d.deposits || []);
      } else if (tab === 'withdrawals') {
        const res = await fetch('/api/admin/withdrawals', { headers: authHeaders });
        if (!res.ok) throw new Error('Failed to load withdrawals');
        const d = await res.json();
        setWithdrawals(d.withdrawals || []);
      } else if (tab === 'transactions') {
        const res = await fetch('/api/admin/transactions', { headers: authHeaders });
        if (!res.ok) throw new Error('Failed to load transactions');
        const d = await res.json();
        setTransactions(d.entries || []);
      } else if (tab === 'games') {
        const res = await fetch('/api/admin/games', { headers: authHeaders });
        if (!res.ok) throw new Error('Failed to load games');
        const d = await res.json();
        setRooms(d.rooms || []);
      } else if (tab === 'audit_logs') {
        const res = await fetch('/api/admin/audit-logs', { headers: authHeaders });
        if (!res.ok) throw new Error('Failed to load audit logs');
        const d = await res.json();
        setAuditLogs(d.auditLogs || []);
      }
    } catch (err: any) {
      setError(err.message || 'Authorization failed or network error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUserStatus = async (playerId: string, status: 'ACTIVE' | 'SUSPENDED' | 'BANNED') => {
    try {
      const res = await fetch(`/api/admin/users/${playerId}/status`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ status })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to update user');
      setSuccessMsg(`User ${playerId} status updated to ${status}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadTabData('users');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleApproveDeposit = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/deposits/${id}/approve`, {
        method: 'POST',
        headers: authHeaders
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to approve deposit');
      setSuccessMsg(`Deposit ${id} approved successfully!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadTabData('deposits');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRejectDeposit = async (id: string) => {
    const reason = window.prompt('Enter rejection reason:') || 'Declined by administrator';
    try {
      const res = await fetch(`/api/admin/deposits/${id}/reject`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reason })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to reject deposit');
      setSuccessMsg(`Deposit ${id} rejected.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadTabData('deposits');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleApproveWithdrawal = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: authHeaders
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to approve withdrawal');
      setSuccessMsg(`Withdrawal ${id} approved & processed!`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadTabData('withdrawals');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleRejectWithdrawal = async (id: string) => {
    const reason = window.prompt('Enter rejection reason:') || 'Declined by administrator';
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ reason })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to reject withdrawal');
      setSuccessMsg(`Withdrawal ${id} rejected and refunded.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadTabData('withdrawals');
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(adjustAmount);
    if (!adjustTargetId || isNaN(amt) || !adjustReason) {
      setError('Please provide target player ID, valid amount, and audit reason');
      return;
    }
    setIsAdjusting(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/balance-adjustment', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          targetPlayerId: adjustTargetId.trim(),
          amount: amt,
          reason: adjustReason.trim()
        })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to adjust balance');
      setSuccessMsg(`Balance adjusted by ${amt} Birr for ${adjustTargetId}`);
      setAdjustTargetId('');
      setAdjustAmount('');
      setAdjustReason('');
      loadTabData('transactions');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAdjusting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-5xl h-[90vh] bg-[#0c1017] border border-amber-400/40 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-black">
              <Shield className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-display text-white tracking-wide">
                  ADMIN CONTROL CENTER
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  BACK-OFFICE ROOT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authorized financial management, user isolation verification & game oversight
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadTabData(activeTab)}
              disabled={loading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-white/10 bg-black/40 overflow-x-auto">
          {[
            { id: 'users', label: 'Users', icon: Users, badge: users.length },
            { id: 'deposits', label: 'Deposits', icon: ArrowDownToLine, badge: deposits.filter(d => d.status === 'PENDING').length },
            { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine, badge: withdrawals.filter(w => w.status === 'PENDING').length },
            { id: 'transactions', label: 'Transactions', icon: Receipt, badge: transactions.length },
            { id: 'games', label: 'Games & Rooms', icon: Gamepad2, badge: rooms.length },
            { id: 'audit_logs', label: 'Audit Logs', icon: FileText, badge: auditLogs.length }
          ].map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id as AdminTab);
                  soundService.playClick();
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-400/40 shadow-sm'
                    : 'text-slate-400 hover:text-white bg-transparent border-transparent hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
                {typeof t.badge === 'number' && t.badge > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                    isActive ? 'bg-amber-400/30 text-amber-200' : 'bg-white/10 text-slate-300'
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Alerts Container */}
        {error && (
          <div className="mx-4 mt-3 p-3 rounded-xl text-xs flex items-center justify-between bg-rose-950/80 border border-rose-500/50 text-rose-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl text-xs flex items-center justify-between bg-emerald-950/80 border border-emerald-500/50 text-emerald-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white font-bold">✕</button>
          </div>
        )}

        {/* Tab Content Stage */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username, playerId, phone, telegram_id..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED'].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                        filterStatus === st
                          ? 'bg-amber-400 text-black border-amber-400'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-semibold">
                      <th className="p-3">User / Identity</th>
                      <th className="p-3">Telegram ID</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Balance</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users
                      .filter((u) => {
                        const matchesQuery =
                          !searchQuery ||
                          u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.playerId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.phone?.includes(searchQuery) ||
                          u.telegram_id?.includes(searchQuery);
                        const matchesStatus =
                          filterStatus === 'ALL' || u.account_status === filterStatus;
                        return matchesQuery && matchesStatus;
                      })
                      .map((u) => (
                        <tr key={u.id || u.playerId} className="hover:bg-white/[0.03] transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-white">{u.username}</div>
                            <div className="text-[10px] font-mono text-slate-400">{u.playerId}</div>
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {u.telegram_id || 'N/A'}
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {u.phone || 'N/A'}
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400">
                            {(u.walletBalance || 0).toLocaleString()} Birr
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              u.role === 'ADMIN' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {u.role || 'USER'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              u.account_status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                              u.account_status === 'SUSPENDED' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              {u.account_status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {u.account_status !== 'ACTIVE' && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u.playerId, 'ACTIVE')}
                                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold cursor-pointer"
                                >
                                  Activate
                                </button>
                              )}
                              {u.account_status === 'ACTIVE' && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u.playerId, 'SUSPENDED')}
                                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] font-bold cursor-pointer"
                                >
                                  Suspend
                                </button>
                              )}
                              {u.account_status !== 'BANNED' && (
                                <button
                                  onClick={() => handleUpdateUserStatus(u.playerId, 'BANNED')}
                                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
                                >
                                  Ban
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: DEPOSITS */}
          {activeTab === 'deposits' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Deposit Requests Management
                </h3>
                <span className="text-xs text-slate-400">
                  {deposits.length} total recorded requests
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-semibold">
                      <th className="p-3">Request ID</th>
                      <th className="p-3">Player</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Method</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {deposits.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No deposit requests found.
                        </td>
                      </tr>
                    ) : (
                      deposits.map((d) => (
                        <tr key={d.id} className="hover:bg-white/[0.03]">
                          <td className="p-3 font-mono text-[10px] text-slate-400">{d.id}</td>
                          <td className="p-3">
                            <div className="font-bold text-white">{d.username}</div>
                            <div className="text-[10px] font-mono text-slate-500">{d.playerId}</div>
                          </td>
                          <td className="p-3 font-mono font-bold text-emerald-400">
                            +{d.amount.toLocaleString()} Birr
                          </td>
                          <td className="p-3 font-semibold text-slate-300">{d.paymentMethod}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              d.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                              d.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                              'bg-rose-500/20 text-rose-300'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-slate-400">
                            {new Date(d.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-right">
                            {d.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveDeposit(d.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectDeposit(d.id)}
                                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500">Processed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: WITHDRAWALS */}
          {activeTab === 'withdrawals' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Withdrawal Requests Management
                </h3>
                <span className="text-xs text-slate-400">
                  {withdrawals.length} total recorded requests
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-semibold">
                      <th className="p-3">Request ID</th>
                      <th className="p-3">Player</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Destination</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {withdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-500">
                          No withdrawal requests found.
                        </td>
                      </tr>
                    ) : (
                      withdrawals.map((w) => (
                        <tr key={w.id} className="hover:bg-white/[0.03]">
                          <td className="p-3 font-mono text-[10px] text-slate-400">{w.id}</td>
                          <td className="p-3">
                            <div className="font-bold text-white">{w.username}</div>
                            <div className="text-[10px] font-mono text-slate-500">{w.playerId}</div>
                          </td>
                          <td className="p-3 font-mono font-bold text-amber-400">
                            -{w.amount.toLocaleString()} Birr
                          </td>
                          <td className="p-3 font-mono text-slate-300">{w.address}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              w.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                              w.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                              'bg-rose-500/20 text-rose-300'
                            }`}>
                              {w.status}
                            </span>
                          </td>
                          <td className="p-3 text-[11px] text-slate-400">
                            {new Date(w.createdAt).toLocaleTimeString()}
                          </td>
                          <td className="p-3 text-right">
                            {w.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleApproveWithdrawal(w.id)}
                                  className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(w.id)}
                                  className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-bold cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-500">Processed</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TRANSACTIONS & MANUAL ADJUSTMENT */}
          {activeTab === 'transactions' && (
            <div className="space-y-6">
              {/* Manual Balance Adjustment Card */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                <div className="flex items-center gap-2 font-bold text-xs text-amber-300 uppercase tracking-wider">
                  <Sliders className="w-4 h-4" />
                  <span>Manual Ledger Balance Adjustment (Audit Logged)</span>
                </div>
                <form onSubmit={handleManualAdjustment} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Target Player ID</label>
                    <input
                      type="text"
                      value={adjustTargetId}
                      onChange={(e) => setAdjustTargetId(e.target.value)}
                      placeholder="e.g. tg_12345678"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Adjustment Amount (+/-)</label>
                    <input
                      type="number"
                      step="any"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      placeholder="e.g. 500 or -200"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Audit Reason</label>
                    <input
                      type="text"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="e.g. Manual VIP reward correction"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isAdjusting}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    {isAdjusting ? 'Applying...' : 'Apply Adjustment'}
                  </button>
                </form>
              </div>

              {/* Transactions Ledger Table */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  System-Wide Transaction Ledger
                </h3>
                <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-semibold">
                        <th className="p-3">Tx ID</th>
                        <th className="p-3">Player</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Balance After</th>
                        <th className="p-3">Description</th>
                        <th className="p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {transactions.slice(0, 50).map((tx) => (
                        <tr key={tx.id} className="hover:bg-white/[0.03]">
                          <td className="p-3 font-mono text-[10px] text-slate-400">{tx.id}</td>
                          <td className="p-3">
                            <div className="font-bold text-white">{tx.username}</div>
                            <div className="text-[10px] font-mono text-slate-500">{tx.playerId}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              tx.type === 'win_payout' ? 'bg-emerald-500/20 text-emerald-300' :
                              tx.type === 'deposit' ? 'bg-cyan-500/20 text-cyan-300' :
                              tx.type === 'buy_in' ? 'bg-amber-500/20 text-amber-300' :
                              tx.type === 'withdrawal' ? 'bg-rose-500/20 text-rose-300' :
                              'bg-purple-500/20 text-purple-300'
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className={`p-3 font-mono font-bold ${
                            tx.type === 'buy_in' || tx.type === 'withdrawal' ? 'text-rose-400' : 'text-emerald-400'
                          }`}>
                            {tx.type === 'buy_in' || tx.type === 'withdrawal' ? '-' : '+'}
                            {tx.amount.toLocaleString()} Birr
                          </td>
                          <td className="p-3 font-mono text-slate-300">
                            {tx.balanceAfter.toLocaleString()} Birr
                          </td>
                          <td className="p-3 text-[11px] text-slate-300 max-w-xs truncate">
                            {tx.description}
                          </td>
                          <td className="p-3 text-[10px] text-slate-500">
                            {new Date(tx.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GAMES & ROOMS */}
          {activeTab === 'games' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                Active Game Rooms & Live Round State
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rooms.map((r) => (
                  <div key={r.roomId} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-sm text-white">{r.roomName}</div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        r.status === 'active' ? 'bg-emerald-500/20 text-emerald-300 animate-pulse' :
                        r.status === 'lobby' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-slate-400 text-[10px]">Cards Sold</div>
                        <div className="font-bold font-mono text-white">{r.totalCardsSold} / {r.totalCatalogCards}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-slate-400 text-[10px]">Total Pot</div>
                        <div className="font-bold font-mono text-emerald-400">{r.totalPot} Birr</div>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <div className="text-slate-400 text-[10px]">Winner Prize</div>
                        <div className="font-bold font-mono text-amber-300">{r.winnerPayoutAmount} Birr</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 border-t border-white/5">
                      <span>Round ID: <span className="font-mono text-slate-300">{r.gameId}</span></span>
                      <span>Stake: <strong className="text-white">{r.betPerCard} Birr</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'audit_logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Immutable Administrative Audit Trail
                </h3>
                <span className="text-xs text-slate-400">
                  {auditLogs.length} audit records
                </span>
              </div>

              <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.02]">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/5 text-slate-400 font-semibold">
                      <th className="p-3">Log ID</th>
                      <th className="p-3">Admin</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target User</th>
                      <th className="p-3">Metadata</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500">
                          No audit logs recorded yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/[0.03]">
                          <td className="p-3 font-mono text-[10px] text-slate-500">{log.id}</td>
                          <td className="p-3 font-bold text-amber-300">{log.admin_user_id}</td>
                          <td className="p-3 font-mono text-xs font-semibold text-white">
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-slate-300">{log.target_user_id}</td>
                          <td className="p-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                            {JSON.stringify(log.metadata || {})}
                          </td>
                          <td className="p-3 text-[11px] text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
