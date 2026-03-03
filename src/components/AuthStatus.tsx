import { useState, useEffect } from 'react'
import { Shield, RefreshCw } from 'lucide-react'
import { cn } from '../lib/utils'

interface AuthData {
  subscriptionType: string | null
  rateLimitTier: string | null
  expiresAt: string | null
  scopes: string[]
  isExpired: boolean
  claudeVersion: string | null
}

function expiryStatus(expiresAt: string | null, isExpired: boolean): 'valid' | 'expiring' | 'expired' | 'unknown' {
  if (!expiresAt) return 'unknown'
  if (isExpired) return 'expired'
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff < 7 * 24 * 60 * 60 * 1000) return 'expiring'
  return 'valid'
}

const statusColors = {
  valid:    'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
  expiring: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
  expired:  'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/30',
  unknown:  'bg-zinc-100 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-500/30',
}

const statusDot = {
  valid:    'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired:  'bg-red-500',
  unknown:  'bg-zinc-400',
}

export function AuthStatus() {
  const [auth, setAuth] = useState<AuthData | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    try {
      const data = await (window as any).electronAPI.getAuthStatus()
      setAuth(data)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32 gap-3 text-zinc-400">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <span className="text-sm">Loading auth status…</span>
      </div>
    )
  }

  if (!auth) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 opacity-40">
        <Shield className="w-10 h-10 text-zinc-400" />
        <p className="text-sm text-zinc-500">No credentials found</p>
        <p className="text-xs text-zinc-400">Expected at ~/.claude/.credentials.json</p>
      </div>
    )
  }

  const status = expiryStatus(auth.expiresAt, auth.isExpired)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', statusDot[status])} />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Credential Status
          </span>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300
                     hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Subscription */}
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Subscription</p>
          <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {auth.subscriptionType ?? 'Unknown'}
          </p>
        </div>

        {/* Rate Tier */}
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Rate Limit Tier</p>
          <p className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
            {auth.rateLimitTier ?? 'Unknown'}
          </p>
        </div>

        {/* Expiry */}
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Token Expiry</p>
          <div className="flex items-center gap-2">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
              statusColors[status]
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', statusDot[status])} />
              {status === 'valid' && 'Valid'}
              {status === 'expiring' && 'Expiring Soon'}
              {status === 'expired' && 'Expired'}
              {status === 'unknown' && 'Unknown'}
            </span>
          </div>
          {auth.expiresAt && (
            <p className="text-xs text-zinc-400 mt-1.5 font-mono">
              {new Date(auth.expiresAt).toLocaleDateString()} {new Date(auth.expiresAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Claude Version */}
        <div className="rounded-xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-1">Claude Version</p>
          <p className="text-lg font-semibold font-mono text-zinc-800 dark:text-zinc-100">
            {auth.claudeVersion ?? '—'}
          </p>
        </div>
      </div>

      {/* Scopes */}
      {auth.scopes.length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">Scopes</p>
          <div className="flex flex-wrap gap-1.5">
            {auth.scopes.map(scope => (
              <span
                key={scope}
                className="px-2.5 py-1 rounded-lg text-xs font-medium
                           bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400
                           border border-blue-200 dark:border-blue-500/20"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
