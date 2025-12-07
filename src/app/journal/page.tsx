
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/utils/cn'

type Trade = {
    id: string
    user_id: string
    pair: string
    type: 'BUY' | 'SELL'
    size: number
    entry: number
    exit: number
    stop_loss: number | null
    pnl: number
    date: string
}

type TradeForm = {
    pair: string
    type: 'BUY' | 'SELL'
    size: number | ''
    entry: number | ''
    exit: number | ''
    stop_loss: number | ''
    pnl: number | ''
    date: string
}

const DEFAULT_PAIRS = [
    'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
    'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'XAU/USD'
]

export default function JournalPage() {
    const supabase = createClient()
    const [trades, setTrades] = useState<Trade[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)
    const [availablePairs, setAvailablePairs] = useState(DEFAULT_PAIRS)
    const [userEmail, setUserEmail] = useState<string>('')
    const [userId, setUserId] = useState<string | null>(null)

    // Form State
    const [formData, setFormData] = useState<TradeForm>({
        pair: 'EUR/USD',
        type: 'BUY',
        size: '',
        entry: '',
        exit: '',
        stop_loss: '',
        pnl: '',
        date: new Date().toISOString().split('T')[0]
    })

    useEffect(() => {
        // Initialize session and fetch data
        const init = async () => {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()

            if (user) {
                setUserId(user.id)
                setUserEmail(user.email || '')

                if (user.email === 'tennyson.onovwiona@gmail.com') {
                    setAvailablePairs([...DEFAULT_PAIRS, 'WTI'])
                }

                // Fetch trades for this user
                const { data, error } = await supabase
                    .from('trades')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('date', { ascending: false })

                if (error) {
                    console.error('Error fetching trades:', error)
                } else {
                    setTrades(data || [])
                }
            } else {
                setTrades([])
            }
            setLoading(false)
        }

        init()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-Calculate PnL
    useEffect(() => {
        const { pair, type, size, entry, exit } = formData

        // Only calculate if all necessary fields have valid numbers
        if (size !== '' && entry !== '' && exit !== '') {
            const s = Number(size)
            const e = Number(entry)
            const x = Number(exit)

            if (s > 0 && e > 0 && x > 0) {
                let diff = 0
                if (type === 'BUY') {
                    diff = x - e
                } else {
                    diff = e - x
                }

                let contractSize = 100000 // Standard FX
                if (pair === 'XAU/USD') contractSize = 100 // Gold
                if (pair === 'WTI') contractSize = 1000 // Oil (typical)

                // Simple Profit Calc: Diff * Size * Contract
                // Note: This assumes quote currency is USD or close to it for estimation.
                // For USDJPY it would be in JPY, requiring division.
                // We'll apply a simple JPY fix for now.
                let profit = diff * s * contractSize

                if (pair.includes('JPY')) {
                    // If it's JPY, the result is in JPY. Convert to USD roughly using Exit price if available.
                    // Or simply: Profit in JPY / Current Rate. We use Exit as proxy for rate.
                    profit = profit / x
                }

                setFormData(prev => ({ ...prev, pnl: parseFloat(profit.toFixed(2)) }))
            }
        }
    }, [formData.pair, formData.type, formData.size, formData.entry, formData.exit])

    async function handleSubmit() {
        try {
            if (!userId) {
                alert('You must be signed in to add trades.')
                return
            }
            // Basic validation
            if (!formData.pair || !formData.date) return

            const payload = {
                ...formData,
                user_id: userId,
                size: Number(formData.size),
                entry: Number(formData.entry),
                exit: Number(formData.exit),
                stop_loss: formData.stop_loss === '' ? null : Number(formData.stop_loss),
                pnl: Number(formData.pnl)
            }

            const { error } = await supabase.from('trades').insert([
                payload
            ])

            if (error) throw error

            setShowAddModal(false)

            // Refresh list (re-fetch to be safe)
            const { data } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', userId)
                .order('date', { ascending: false })

            setTrades(data || [])

            // Reset form (keep date)
            setFormData({
                pair: 'EUR/USD',
                type: 'BUY',
                size: '',
                entry: '',
                exit: '',
                stop_loss: '',
                pnl: '',
                date: new Date().toISOString().split('T')[0]
            })
        } catch (err) {
            console.error('Error adding trade:', err)
            alert('Failed to add trade. Does the "trades" table have a "stop_loss" column?')
        }
    }

    return (
        <div className="min-h-screen p-8 relative">
            <div className="max-w-7xl mx-auto space-y-8">

                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-white">Trade Journal</h1>
                        <p className="text-slate-400 mt-2 text-sm md:text-base">Track your performance and learn from your history.</p>
                    </div>
                    {userId ? (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors whitespace-nowrap flex-shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            New Trade
                        </button>
                    ) : (
                        <div className="text-sm text-yellow-400 bg-yellow-400/10 px-4 py-2 rounded-lg border border-yellow-400/20">
                            Sign in to manage your journal
                        </div>
                    )}
                </div>

                {/* Desktop View (Table) */}
                <div className="hidden md:block glass-panel rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-white/5 text-slate-200 font-medium">
                            <tr>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Pair</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Size</th>
                                <th className="px-6 py-4">Entry</th>
                                <th className="px-6 py-4">Exit</th>
                                <th className="px-6 py-4 text-right">PnL</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {trades.map((trade) => (
                                <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 font-mono">{trade.date}</td>
                                    <td className="px-6 py-4 font-medium text-white">{trade.pair}</td>
                                    <td className="px-6 py-4">
                                        <span className={cn("px-2 py-1 rounded text-xs font-bold",
                                            trade.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                        )}>
                                            {trade.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono">{trade.size}</td>
                                    <td className="px-6 py-4 font-mono">{trade.entry}</td>
                                    <td className="px-6 py-4 font-mono">{trade.exit}</td>
                                    <td className={cn("px-6 py-4 font-mono font-bold text-right",
                                        trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                    )}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-slate-500 hover:text-red-400 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!loading && trades.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            {userId ? "No trades recorded yet. Start journaling!" : "Sign in to see your trades."}
                        </div>
                    )}
                </div>

                {/* Mobile View (Cards) */}
                <div className="md:hidden space-y-4 pb-20">
                    {trades.map((trade) => (
                        <div key={trade.id} className="glass-panel p-4 rounded-xl space-y-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="text-white font-bold text-lg">{trade.pair}</div>
                                    <div className="text-slate-500 text-xs font-mono">{trade.date}</div>
                                </div>
                                <span className={cn("px-2 py-1 rounded text-xs font-bold",
                                    trade.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                )}>
                                    {trade.type}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="space-y-0.5">
                                    <div className="text-slate-500 text-xs">Entry</div>
                                    <div className="font-mono text-slate-300">{trade.entry}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-slate-500 text-xs">Exit</div>
                                    <div className="font-mono text-slate-300">{trade.exit}</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-slate-500 text-xs">Size</div>
                                    <div className="font-mono text-slate-300">{trade.size} Lots</div>
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-slate-500 text-xs">Stop Loss</div>
                                    <div className="font-mono text-slate-300">{trade.stop_loss || '-'}</div>
                                </div>
                            </div>

                            <div className="pt-3 border-t border-white/5 flex justify-between items-center">
                                <div className="text-slate-400 text-sm">P/L</div>
                                <div className={cn("font-mono font-bold text-lg",
                                    trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                                )}>
                                    {trade.pnl >= 0 ? '+' : ''}{trade.pnl}
                                </div>
                            </div>
                        </div>
                    ))}
                    {!loading && trades.length === 0 && (
                        <div className="p-8 text-center text-slate-500 glass-panel rounded-xl">
                            {userId ? "No trades recorded yet." : "Sign in to see your trades."}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="glass-panel w-full max-w-lg rounded-2xl p-6 space-y-6">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">Add New Trade</h2>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Date</label>
                                <input
                                    type="date"
                                    value={formData.date}
                                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Pair</label>
                                <select
                                    value={formData.pair}
                                    onChange={e => setFormData({ ...formData, pair: e.target.value })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white appearance-none"
                                >
                                    {availablePairs.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Type</label>
                                <select
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white appearance-none"
                                >
                                    <option value="BUY">BUY</option>
                                    <option value="SELL">SELL</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Size (Lots)</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.size}
                                    onChange={e => setFormData({ ...formData, size: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white placeholder:text-slate-600"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Entry Price</label>
                                <input
                                    type="number"
                                    placeholder="0.00000"
                                    value={formData.entry}
                                    onChange={e => setFormData({ ...formData, entry: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white placeholder:text-slate-600"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Exit Price</label>
                                <input
                                    type="number"
                                    placeholder="0.00000"
                                    value={formData.exit}
                                    onChange={e => setFormData({ ...formData, exit: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white placeholder:text-slate-600"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">Stop Loss (Optional)</label>
                                <input
                                    type="number"
                                    placeholder="0.00000"
                                    value={formData.stop_loss}
                                    onChange={e => setFormData({ ...formData, stop_loss: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white placeholder:text-slate-600"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-slate-400">P/L ($) - Auto</label>
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={formData.pnl}
                                    onChange={e => setFormData({ ...formData, pnl: e.target.value === '' ? '' : Number(e.target.value) })}
                                    className="input-glass w-full px-3 py-2 rounded-lg text-white placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 text-sm font-medium"
                            >
                                Save Trade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

