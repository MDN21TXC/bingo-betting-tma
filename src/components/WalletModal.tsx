import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Sparkles,
  X,
  RefreshCw,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
  Phone,
  Clock,
  Building2,
  CreditCard
} from 'lucide-react';
import { UserAccount, LedgerEntry } from '../types/bingo.js';
import { soundService } from '../services/soundService.js';
import { telegramSdk } from '../services/telegramSdk.js';

interface WalletModalProps {
  isOpen: boolean;
  initialTab?: 'deposit' | 'withdraw' | 'history';
  onClose: () => void;
  user: UserAccount | null;
  onUpdateUser: (user: UserAccount) => void;
  onOpenSignUp?: () => void;
  onOpenLogin?: () => void;
}

export const WalletModal: React.FC<WalletModalProps> = ({
  isOpen,
  initialTab = 'deposit',
  onClose,
  user,
  onUpdateUser,
}) => {
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw' | 'history'>(initialTab);
  const [paymentProvider, setPaymentProvider] = useState<'TELEBIRR' | 'CBE' | 'CHAPA'>('TELEBIRR');
  const [depositAmount, setDepositAmount] = useState<number | ''>(100);
  const [withdrawAmount, setWithdrawAmount] = useState<number | ''>('');
  const [withdrawAddress, setWithdrawAddress] = useState<string>(user?.phone || '');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'deposit' | 'win_payout' | 'withdrawal'>('all');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialTab) setActiveTab(initialTab);
      if (user?.playerId) fetchLedger();
      if (user?.phone) setWithdrawAddress(user.phone);
    }
  }, [isOpen, initialTab, user?.playerId, user?.phone]);

  if (!isOpen) return null;

  const fetchLedger = async () => {
    if (!user?.playerId) return;
    try {
      const res = await fetch(`/api/ledger/${user.playerId}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerEntries(data.entries || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeposit = async () => {
    const numAmount = typeof depositAmount === 'number' ? depositAmount : 0;
    if (!user?.playerId || numAmount < 10) {
      soundService.playError();
      return;
    }
    setLoading(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: user.playerId,
          amount: numAmount,
          paymentMethod: paymentProvider
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        soundService.playLineChime();
        telegramSdk.triggerHaptic('success');
        setSuccessMsg(`Successfully deposited ${numAmount.toLocaleString()} Birr via ${paymentProvider}! Instant balance updated.`);
        fetchLedger();
      }
    } catch (e) {
      soundService.playError();
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const numAmount = typeof withdrawAmount === 'number' ? withdrawAmount : 0;
    if (!user?.playerId || numAmount <= 0 || numAmount > (user.walletBalance || 0)) {
      soundService.playError();
      return;
    }
    setLoading(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: user.playerId,
          amount: numAmount,
          withdrawAddress: withdrawAddress || `${paymentProvider} Account`
        })
      });
      const data = await res.json();
      if (data.success && data.user) {
        onUpdateUser(data.user);
        soundService.playLineChime();
        telegramSdk.triggerHaptic('success');
        setSuccessMsg(`Withdrawal of ${numAmount.toLocaleString()} Birr requested via ${paymentProvider}!`);
        setWithdrawAmount('');
        fetchLedger();
      }
    } catch (e) {
      soundService.playError();
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentBalance = user?.walletBalance || 0;
  const numDeposit = typeof depositAmount === 'number' ? depositAmount : 0;
  const presetAmounts = [50, 100, 250, 500];

  const filteredLedger = ledgerEntries.filter((entry) => {
    if (ledgerFilter === 'all') return true;
    return entry.type === ledgerFilter;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md text-white overflow-y-auto animate-fadeIn select-none font-sans">
      <div className="relative w-full max-w-lg my-auto rounded-3xl bg-[#111111] border border-white/15 shadow-[0_0_50px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Ambient Glow */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-[#E8FF00]/10 via-transparent to-transparent pointer-events-none" />

        {/* Header */}
        <header className="relative z-20 w-full px-5 py-3.5 bg-[#161616]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                soundService.playClick();
                onClose();
              }}
              className="w-8 h-8 rounded-xl bg-[#202020] hover:bg-[#282828] text-white/80 hover:text-white border border-white/10 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-arcade font-black text-base text-white uppercase tracking-wider">
                BINGO CASHIER
              </span>
              <span className="text-[9px] font-arcade font-black px-2 py-0.5 rounded-full bg-[#E8FF00] text-black uppercase">
                INSTANT PAYOUT
              </span>
            </div>
          </div>

          <button
            onClick={() => {
              soundService.playClick();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-[#202020] hover:bg-[#282828] text-white/60 hover:text-white border border-white/10 transition-all flex items-center justify-center cursor-pointer active:scale-95"
            title="Close Cashier"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4 w-full">
        {/* 1. HUGE CURRENT BALANCE DISPLAY */}
        <div className="p-4 rounded-2xl bg-[#111111] border border-white/10 text-center space-y-1 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-arcade font-bold text-white/50 uppercase tracking-widest">
              CURRENT WALLET BALANCE
            </span>
            <button
              onClick={() => {
                soundService.playClick();
                fetchLedger();
              }}
              className="p-1 rounded-lg bg-[#181818] text-white/60 hover:text-white"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="font-arcade font-black text-3xl sm:text-4xl text-[#E8FF00] tracking-tight drop-shadow-[0_0_15px_rgba(232,255,0,0.3)]">
            {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} BIRR
          </div>

          <div className="flex items-center justify-center gap-2 text-[10px] font-arcade text-white/40">
            <span>PLAYER: <strong className="text-white">{user?.username}</strong></span>
            <span>•</span>
            <span className="text-emerald-400">● 100% READY TO PLAY</span>
          </div>
        </div>

        {/* 2. TAB SWITCHER */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#141414] border border-white/10">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('deposit');
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer font-arcade font-black uppercase ${
              activeTab === 'deposit'
                ? 'bg-[#E8FF00] text-black shadow-[0_0_10px_rgba(232,255,0,0.3)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[3]" />
            <span>DEPOSIT</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('withdraw');
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer font-arcade font-black uppercase ${
              activeTab === 'withdraw'
                ? 'bg-[#E8FF00] text-black shadow-[0_0_10px_rgba(232,255,0,0.3)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
            <span>WITHDRAW</span>
          </button>

          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('history');
              setSuccessMsg(null);
            }}
            className={`py-2 text-xs rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer font-arcade font-black uppercase ${
              activeTab === 'history'
                ? 'bg-[#E8FF00] text-black shadow-[0_0_10px_rgba(232,255,0,0.3)]'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5 stroke-[3]" />
            <span>LEDGER</span>
          </button>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-arcade text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="font-bold px-1 text-emerald-400">✕</button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB 1: DEPOSIT                                     */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'deposit' && (
          <div className="space-y-3.5">
            {/* Payment Method Selector (Telebirr / CBE / Chapa) */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-arcade font-black text-white/60 uppercase">
                CHOOSE PAYMENT METHOD
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'TELEBIRR' as const, name: 'Telebirr', icon: Phone, badge: 'INSTANT' },
                  { id: 'CBE' as const, name: 'CBE Birr', icon: Building2, badge: 'DIRECT' },
                  { id: 'CHAPA' as const, name: 'Chapa', icon: CreditCard, badge: 'CARDS' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      soundService.playClick();
                      setPaymentProvider(item.id);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                      paymentProvider === item.id
                        ? 'bg-[#181818] border-2 border-[#E8FF00] shadow-[0_0_12px_rgba(232,255,0,0.25)]'
                        : 'bg-[#111111] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${paymentProvider === item.id ? 'text-[#E8FF00]' : 'text-white/60'}`} />
                    <span className="font-arcade font-black text-xs text-white mt-1">{item.name}</span>
                    <span className="text-[7px] font-arcade text-white/40">{item.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Fast Preset Deposit Buttons */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-arcade font-black text-white/60 uppercase">
                FAST PRESET AMOUNTS
              </span>
              <div className="grid grid-cols-4 gap-2">
                {presetAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => {
                      soundService.playClick();
                      setDepositAmount(amt);
                    }}
                    className={`py-2 rounded-xl font-arcade font-black text-xs transition-all cursor-pointer ${
                      depositAmount === amt
                        ? 'bg-[#E8FF00] text-black shadow-[0_0_10px_rgba(232,255,0,0.4)]'
                        : 'bg-[#161616] border border-white/10 text-white hover:border-white/30'
                    }`}
                  >
                    +{amt} B
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-arcade font-black text-white/60 uppercase">
                OR ENTER CUSTOM AMOUNT (BIRR)
              </span>
              <div className="relative rounded-2xl bg-[#141414] border-2 border-[#E8FF00]/40 focus-within:border-[#E8FF00] p-3">
                <div className="flex items-center gap-3">
                  <span className="font-arcade font-black text-lg text-[#E8FF00]">ETB</span>
                  <input
                    type="number"
                    min={10}
                    max={50000}
                    value={depositAmount === '' ? '' : depositAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') setDepositAmount('');
                      else setDepositAmount(parseInt(val, 10) || '');
                    }}
                    placeholder="100"
                    className="w-full bg-transparent font-arcade font-black text-2xl text-white outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Deposit CTA */}
            <button
              onClick={handleDeposit}
              disabled={loading || numDeposit < 10}
              className="btn-neon w-full py-3.5 rounded-2xl text-xs font-arcade font-black uppercase tracking-wide cursor-pointer disabled:opacity-40"
            >
              {loading ? 'PROCESSING...' : `DEPOSIT ${numDeposit} BIRR VIA ${paymentProvider}`}
            </button>

            {/* High Trust Badges */}
            <div className="flex items-center justify-center gap-2 text-center text-[10px] font-arcade text-white/40 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Instant Confirmation • 0% Deposit Fee • Official Verified Merchant</span>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB 2: WITHDRAW                                    */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'withdraw' && (
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-arcade font-black text-white/60 uppercase">
                TELEBIRR / CBE ACCOUNT PHONE
              </label>
              <div className="rounded-xl bg-[#141414] border border-white/10 p-2.5 flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#E8FF00]" />
                <input
                  type="tel"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="bg-transparent font-arcade text-xs text-white outline-none w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-arcade font-black text-white/60 uppercase">
                  WITHDRAW AMOUNT (BIRR)
                </span>
                <button
                  onClick={() => setWithdrawAmount(Math.floor(currentBalance))}
                  className="font-arcade text-xs text-[#E8FF00] hover:underline cursor-pointer"
                >
                  MAX ({Math.floor(currentBalance)} B)
                </button>
              </div>

              <div className="rounded-2xl bg-[#141414] border-2 border-white/20 focus-within:border-[#E8FF00] p-3 flex items-center gap-3">
                <span className="font-arcade font-black text-lg text-[#E8FF00]">ETB</span>
                <input
                  type="number"
                  min={10}
                  max={Math.floor(currentBalance)}
                  value={withdrawAmount === '' ? '' : withdrawAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setWithdrawAmount('');
                    else setWithdrawAmount(parseInt(val, 10) || '');
                  }}
                  placeholder="50"
                  className="w-full bg-transparent font-arcade font-black text-2xl text-white outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={loading || !withdrawAmount || withdrawAmount <= 0 || withdrawAmount > currentBalance}
              className="btn-neon w-full py-3.5 rounded-2xl text-xs font-arcade font-black uppercase tracking-wide cursor-pointer disabled:opacity-40"
            >
              {loading ? 'PROCESSING...' : `WITHDRAW ${withdrawAmount || 0} BIRR`}
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* TAB 3: LEDGER                                      */}
        {/* ══════════════════════════════════════════════════ */}
        {activeTab === 'history' && (
          <div className="space-y-2">
            <span className="text-[10px] font-arcade font-black text-white/40 uppercase tracking-wider block">
              RECENT WALLET TRANSACTIONS
            </span>

            {filteredLedger.length === 0 ? (
              <div className="p-6 rounded-2xl bg-[#111111] border border-white/10 text-center text-xs font-arcade text-white/40">
                No transactions recorded yet.
              </div>
            ) : (
              filteredLedger.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-[#111111] border border-white/10 flex items-center justify-between"
                >
                  <div>
                    <div className="font-arcade font-black text-xs text-white capitalize">
                      {entry.type.replace('_', ' ')}
                    </div>
                    <div className="text-[9px] font-arcade text-white/40">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className={`font-arcade font-black text-xs ${
                    entry.type === 'win_payout' || entry.type === 'deposit'
                      ? 'text-[#E8FF00]'
                      : 'text-rose-400'
                  }`}>
                    {entry.type === 'buy_in' ? '-' : '+'}
                    {entry.amount.toLocaleString()} BIRR
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  </div>
);
};
