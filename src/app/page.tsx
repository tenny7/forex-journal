'use client'

import { useState, useMemo, useEffect } from 'react'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'

const DEFAULT_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'XAU/USD'
]

export default function CalculatorPage() {
  const supabase = createClient()
  const [balance, setBalance] = useState<number | ''>('')
  const [riskMode, setRiskMode] = useState<'percent' | 'fixed'>('percent')
  const [riskPercent, setRiskPercent] = useState<number>(1)
  const [riskAmountFixed, setRiskAmountFixed] = useState<number | ''>('')
  const [stopLoss, setStopLoss] = useState<number | ''>('')
  const [rewardRatio, setRewardRatio] = useState<number | ''>(2)
  const [pair, setPair] = useState<string>('EUR/USD')
  const [availablePairs, setAvailablePairs] = useState(DEFAULT_PAIRS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load state from sessionStorage on mount
  useEffect(() => {
    const savedState = sessionStorage.getItem('calcState')
    if (savedState) {
      try {
        const { timestamp, data } = JSON.parse(savedState)
        const age = Date.now() - timestamp
        // 1 hour = 3600000 ms
        if (age < 3600000) {
          if (data.balance !== undefined) setBalance(data.balance)
          if (data.riskMode !== undefined) setRiskMode(data.riskMode)
          if (data.riskPercent !== undefined) setRiskPercent(data.riskPercent)
          if (data.riskAmountFixed !== undefined) setRiskAmountFixed(data.riskAmountFixed)
          if (data.stopLoss !== undefined) setStopLoss(data.stopLoss)
          if (data.pair !== undefined) setPair(data.pair)
          if (data.rewardRatio !== undefined) setRewardRatio(data.rewardRatio)
        } else {
          sessionStorage.removeItem('calcState')
        }
      } catch (e) {
        console.error('Failed to parse saved state', e)
      }
    }
    setIsLoaded(true)

    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email === 'tennyson.onovwiona@gmail.com') {
        setAvailablePairs([...DEFAULT_PAIRS, 'WTI'])
      }
    }
    checkUser()
  }, [])

  // Save state to sessionStorage on change
  useEffect(() => {
    if (!isLoaded) return // Don't save initial default values overwriting storage

    const state = {
      balance,
      riskMode,
      riskPercent,
      riskAmountFixed,
      stopLoss,
      pair,
      rewardRatio
    }
    sessionStorage.setItem('calcState', JSON.stringify({
      timestamp: Date.now(),
      data: state
    }))
  }, [balance, riskMode, riskPercent, riskAmountFixed, stopLoss, pair, rewardRatio, isLoaded])

  const results = useMemo(() => {
    // Treat empty strings as 0 for calculation
    const balVal = balance === '' ? 0 : balance
    const riskFixedVal = riskAmountFixed === '' ? 0 : riskAmountFixed
    const slushVal = stopLoss === '' ? 0 : stopLoss
    const rrVal = rewardRatio === '' ? 0 : rewardRatio

    let riskAmt = 0
    if (riskMode === 'percent') {
      riskAmt = (balVal * riskPercent) / 100
    } else {
      riskAmt = riskFixedVal
    }

    // Standard pip value estimation (simplify for MVP)
    // For XXX/USD, pip value is $10 per standard lot.
    // For others it varies, but let's stick to $10 base for now or adjust slightly for JPY.
    // XAU/USD pip is different (0.10 or 1.00 move).
    // Let's assume standard $10/pip for now to get logic working.

    let pipValuePerStandardLot = 10
    if (pair.includes('JPY')) pipValuePerStandardLot = 7 // Rough approx
    if (pair === 'XAU/USD') pipValuePerStandardLot = 1 // Gold points logic varies
    if (pair === 'WTI') pipValuePerStandardLot = 10 // Assumption for Crude

    // Handle divide by zero
    const denominator = slushVal * pipValuePerStandardLot
    const lots = denominator === 0 ? 0 : riskAmt / denominator
    const units = lots * 100000

    // Lot Type Logic
    let lotType = 'Standard Lot'
    let lotTypeColor = 'text-blue-400 bg-blue-400/10'
    if (lots < 0.01) {
      lotType = 'Nano Lot'
      lotTypeColor = 'text-orange-400 bg-orange-400/10'
    } else if (lots < 0.1) {
      lotType = 'Micro Lot'
      lotTypeColor = 'text-purple-400 bg-purple-400/10'
    } else if (lots < 1.0) {
      lotType = 'Mini Lot'
      lotTypeColor = 'text-green-400 bg-green-400/10'
    }

    return {
      riskAmount: riskAmt,
      lots: isFinite(lots) ? lots : 0,
      units: isFinite(units) ? units : 0,
      pipValue: pipValuePerStandardLot,
      lotType,
      lotTypeColor,
      potentialProfit: riskAmt * rrVal,
      takeProfitPips: slushVal * rrVal
    }
  }, [balance, riskMode, riskPercent, riskAmountFixed, stopLoss, pair, rewardRatio])

  return (
    <div className="min-h-[calc(100vh-80px)] p-4 pb-20">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-160px)]">
        <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8">

          {/* Left: Inputs */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Position Size Calculator
              </h1>
              <p className="text-slate-400 mt-2">
                Calculate your exact lot size and manage risk effectively.
              </p>
            </div>

            <div className="glass-panel p-6 rounded-2xl space-y-6">
              {/* Account Balance */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Account Balance ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input-glass w-full pl-8 pr-4 py-3 rounded-xl text-white font-mono placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* Risk Management */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-slate-300">Risk Method</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-950/50 p-1 rounded-xl border border-white/5">
                  <button
                    onClick={() => setRiskMode('percent')}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all",
                      riskMode === 'percent' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Percentage %
                  </button>
                  <button
                    onClick={() => setRiskMode('fixed')}
                    className={cn(
                      "py-2 rounded-lg text-sm font-medium transition-all",
                      riskMode === 'fixed' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-slate-400 hover:text-white"
                    )}
                  >
                    Fixed Amount $
                  </button>
                </div>

                {riskMode === 'percent' ? (
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm text-slate-400">
                      <span>Risk Percentage</span>
                      <span className="text-white font-mono">{riskPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-800 accent-blue-500"
                    />
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>0.1%</span>
                      <span>5%</span>
                      <span>10%</span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={riskAmountFixed}
                      onChange={(e) => setRiskAmountFixed(e.target.value === '' ? '' : Number(e.target.value))}
                      className="input-glass w-full pl-8 pr-4 py-3 rounded-xl text-white font-mono placeholder:text-slate-600"
                    />
                  </div>
                )}
              </div>


              {/* Stop Loss, Pair & Reward Ratio */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Stop Loss (Pips)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value === '' ? '' : Number(e.target.value))}
                    className="input-glass w-full px-4 py-3 rounded-xl text-white font-mono placeholder:text-slate-600"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Pair</label>
                  <select
                    value={pair}
                    onChange={(e) => setPair(e.target.value)}
                    className="input-glass w-full px-4 py-3 rounded-xl text-white appearance-none"
                  >
                    {availablePairs.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-medium text-slate-300">Risk : Reward Ratio (1 : X)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">1:</span>
                    <input
                      type="number"
                      placeholder="2"
                      value={rewardRatio}
                      onChange={(e) => setRewardRatio(e.target.value === '' ? '' : Number(e.target.value))}
                      className="input-glass w-full pl-8 px-4 py-3 rounded-xl text-white font-mono placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="flex flax-col justify-center">
            <div className="glass-panel w-full p-8 rounded-2xl flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400" />

              <div className="space-y-8 relative z-10">
                {/* Risk Level Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Risk Level</span>
                    <span className="text-white font-mono">{riskMode === 'percent' ? riskPercent + '%' : 'Fixed'}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-300"
                      style={{ width: `${Math.min(riskMode === 'percent' ? riskPercent * 10 : 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <h2 className="text-slate-400 text-sm font-medium uppercase tracking-wider mb-2">Position Size</h2>
                  <div className="text-5xl font-bold text-white tracking-tight">
                    {results.lots.toFixed(2)} <span className="text-xl text-slate-500 font-normal">Lots</span>
                  </div>
                  <div className="mt-4">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider", results.lotTypeColor)}>
                      {results.lotType}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-slate-400">Risk Amount</span>
                    <span className="text-xl font-mono text-red-400">
                      -${results.riskAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-slate-400">Potential Profit</span>
                    <span className="text-xl font-mono text-green-400">
                      +${results.potentialProfit.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-3 border-b border-white/5">
                    <span className="text-slate-400">Take Profit Target</span>
                    <span className="text-xl font-mono text-white">
                      {results.takeProfitPips} <span className="text-sm text-slate-500">pips</span>
                    </span>
                  </div>

                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-xs text-slate-500">
                  Calculations are estimates. Always verify with your broker.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Explanation Section */}
      <div className="max-w-4xl mx-auto space-y-12">
        {/* Lot Types Cards */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-center text-white">
            Understanding <span className="text-blue-500">Forex Lot Sizes</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { type: 'Standard Lot', units: '100,000', val: '$10 per pip', icon: 'S', color: 'bg-blue-600' },
              { type: 'Mini Lot', units: '10,000', val: '$1 per pip', icon: 'M', color: 'bg-green-600' },
              { type: 'Micro Lot', units: '1,000', val: '$0.10 per pip', icon: 'μ', color: 'bg-purple-600' },
              { type: 'Nano Lot', units: '100', val: '$0.01 per pip', icon: 'N', color: 'bg-orange-600' },
            ].map((item) => (
              <div key={item.type} className="glass-panel p-6 rounded-2xl flex flex-col items-center text-center space-y-3">
                <div className={cn("w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white", item.color)}>
                  {item.icon}
                </div>
                <h3 className="font-bold text-white">{item.type}</h3>
                <p className="text-xs text-slate-400">{item.units} units</p>
                <p className={cn("text-sm font-bold", item.color.replace('bg-', 'text-'))}>{item.val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Formula Section */}
        <div className="glass-panel p-8 rounded-2xl space-y-8">
          <h2 className="text-2xl font-bold text-center text-white">Position Size Formula</h2>
          <div className="bg-slate-950/50 p-6 rounded-xl text-center font-mono text-sm sm:text-lg text-slate-300 border border-white/5">
            Position Size = (Account × Risk%) ÷ (Stop Loss × Pip Value)
          </div>
          <div className="grid md:grid-cols-2 gap-8 text-sm">
            <div className="space-y-2">
              <p><span className="text-blue-400 font-bold">Account:</span> Your total account balance</p>
              <p><span className="text-green-400 font-bold">Risk%:</span> Percentage of account to risk</p>
              <p><span className="text-purple-400 font-bold">Stop Loss:</span> Pips until stop loss</p>
            </div>
            <div className="space-y-2">
              <p><span className="text-orange-400 font-bold">Pip Value:</span> Value per pip (varies by pair)</p>
              <p><span className="text-red-400 font-bold">Result:</span> Optimal lot size for your risk</p>
            </div>
          </div>
          <p className="text-center text-slate-500 text-sm max-w-2xl mx-auto">
            This formula ensures you never risk more than your predetermined percentage per trade, protecting your account from significant losses while maximizing potential gains.
          </p>
        </div>
      </div>

    </div>
  )
}
