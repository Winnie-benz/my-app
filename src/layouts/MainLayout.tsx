import { useEffect, useMemo, useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, LayoutGrid, ScanLine, AlertTriangle, Users, BarChart2, LogOut, ClipboardList, Settings, Wallet, History, PackageSearch, ShieldAlert, BrainCircuit } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useProductStore } from '../store/useProductStore'
import { useCustomerStore } from '../store/useCustomerStore'
import type { Claim } from '../types/customer'

const BASE_NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'ภาพรวม', icon: Home },
    ],
  },
  {
    label: 'คลังสินค้า',
    items: [
      { to: '/stock',             label: 'จัดการสต็อก',  icon: LayoutGrid    },
      { to: '/stock-check',       label: 'ตรวจนับสต็อก', icon: ScanLine      },
      { to: '/inventory-history', label: 'ประวัติตรวจนับ', icon: History       },
      { to: '/lens-products',    label: 'สินค้าเลนส์',    icon: PackageSearch },
      { to: '/low-stock',         label: 'สต็อกต่ำ',     icon: AlertTriangle },
    ],
  },
  {
    label: 'ลูกค้า',
    items: [
      { to: '/customers',     label: 'รายชื่อลูกค้า', icon: Users         },
      { to: '/outstanding',   label: 'ค้างชำระ',       icon: Wallet        },
      { to: '/orders',        label: 'Orders',          icon: ClipboardList },
      { to: '/claims',        label: 'เคลม/ประกัน',    icon: ShieldAlert   },
      { to: '/pending-costs', label: 'ต้นทุนรอกรอก',  icon: ClipboardList },
    ],
  },
  {
    label: 'วิเคราะห์',
    items: [
      { to: '/reports',    label: 'รายงาน',       icon: BarChart2    },
      { to: '/analytics',  label: 'AI Analyst',   icon: BrainCircuit },
    ],
  },
]

function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  return Math.round((date.getTime() - today.getTime()) / 86400000)
}

function isPickupAlert(dateStr: string): boolean {
  const days = daysUntil(dateStr)
  return days !== null && days <= 3
}

function isPickupToday(dateStr: string): boolean {
  return daysUntil(dateStr) === 0
}

function claimOrderStatus(claim: Claim) {
  return claim.order_status ?? (claim.status === 'resolved' ? 'completed' : claim.status === 'in_progress' ? 'cutting' : 'waiting')
}

export default function MainLayout() {
  const { user, logout } = useAuth()
  const fetchProducts = useProductStore(s => s.fetchProducts)
  const fetchAll      = useCustomerStore(s => s.fetchAll)
  const products      = useProductStore(s => s.products)
  const purchases     = useCustomerStore(s => s.purchases)

  useEffect(() => {
    fetchProducts()
    fetchAll()
  }, [])

  const [claims, setClaims] = useState<Claim[]>([])

  const badgeMap = useMemo<Record<string, number>>(() => ({
    '/dashboard':     purchases.filter(p => isPickupToday(p.pickup_date) && p.order_status !== 'completed').length,
    '/low-stock':     products.filter(p => p.stock_current <= (p.reorder_point ?? 1)).length,
    '/pending-costs': purchases.filter(p => p.cost_lens === null || p.cost_frame === null || p.cost_other === null).length,
    '/outstanding':   purchases.filter(p => p.payment_status === 'pending' || p.payment_status === 'partial').length,
    '/orders':        purchases.filter(p => isPickupAlert(p.pickup_date) && p.order_status !== 'completed').length
      + claims.filter(c => isPickupAlert(c.pickup_date) && claimOrderStatus(c) !== 'completed').length,
  }), [purchases, products, claims])

  // claims badge — fetched separately (not in customer store)
  useEffect(() => {
    function loadClaims() {
      import('../services/api').then(({ api }) =>
        api.claims.list().then(r => {
          setClaims(r.data)
        }).catch(() => {})
      )
    }

    loadClaims()
    window.addEventListener('claims-updated', loadClaims)
    return () => window.removeEventListener('claims-updated', loadClaims)
  }, [])

  const navGroups = useMemo(() => {
    if (user?.role !== 'admin') return BASE_NAV_GROUPS
    return [
      ...BASE_NAV_GROUPS,
      { label: 'ระบบ', items: [{ to: '/settings', label: 'ตั้งค่า', icon: Settings }] },
    ]
  }, [user?.role])

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0">

        {/* Logo */}
        <div className="h-14 px-5 flex items-center border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">ST</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">Winnie</p>
              <p className="text-[10px] text-slate-400 leading-none mt-0.5">Stock Management</p>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(({ to, label, icon: Icon }) => {
                  const badge = to === '/claims'
                    ? claims.filter(c => c.status !== 'resolved').length
                    : (badgeMap[to] ?? 0)
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`
                      }
                    >
                      <Icon size={16} />
                      <span className="flex-1">{label}</span>
                      {badge > 0 && (
                        <span className="text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div className="px-3 py-3 border-t border-slate-100 space-y-1 shrink-0">
          {user && (
            <div className="px-3 py-2 rounded-xl bg-slate-50">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user.nickname || user.first_name}
              </p>
              <p className="text-[11px] text-slate-400">
                {user.role === 'admin' ? 'Admin' : 'Staff'}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-slate-500 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut size={15} />
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
