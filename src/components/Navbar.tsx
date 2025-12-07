'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Calculator, LogIn, LogOut, User } from 'lucide-react'
import { cn } from '@/utils/cn'
import { createClient } from '@/utils/supabase/client'
import { useEffect, useState } from 'react'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function Navbar() {
    const pathname = usePathname()
    const supabase = createClient()
    const [user, setUser] = useState<SupabaseUser | null>(null)

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            setUser(session?.user ?? null)
        })
        return () => subscription.unsubscribe()
    }, [supabase.auth])

    const handleLogin = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${location.origin}/auth/callback`,
            },
        })
    }

    const handleLogout = async () => {
        await supabase.auth.signOut()
        setUser(null)
    }

    const navItems = [
        { name: 'Calculator', href: '/', icon: Calculator },
        { name: 'Journal', href: '/journal', icon: BookOpen },
    ]

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-8">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center">
                                <span className="font-bold text-white">F</span>
                            </div>
                            <span className="font-bold text-lg tracking-tight">ForexJournal</span>
                        </Link>

                        <div className="hidden md:flex items-center gap-1">
                            {navItems.map((item) => {
                                const isActive = pathname === item.href
                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-white/10 text-white"
                                                : "text-slate-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <item.icon className="w-4 h-4" />
                                        {item.name}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>

                    {user ? (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <User className="w-4 h-4" />
                                <span className="hidden sm:inline">{user.email?.split('@')[0]}</span>
                            </div>
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <button
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
                            onClick={handleLogin}
                        >
                            <LogIn className="w-4 h-4" />
                            Sign In with Google
                        </button>
                    )}
                </div>
            </div>
        </nav>
    )
}
