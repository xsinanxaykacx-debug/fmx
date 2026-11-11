import { useGameStore } from '@/store/useGameStore';
import { LayoutDashboard, Users, ClipboardList, Trophy, ArrowRightLeft, DollarSign, Calendar, Mail, LogOut } from 'lucide-react';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
  { id: 'squad', label: 'Kadro', icon: Users },
  { id: 'tactics', label: 'Taktikler', icon: ClipboardList },
  { id: 'league', label: 'Lig', icon: Trophy },
  { id: 'transfers', label: 'Transferler', icon: ArrowRightLeft },
  { id: 'finance', label: 'Finans', icon: DollarSign },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-screen shrink-0">
      <div className="p-4 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-slate-950">
          FM
        </div>
        <div>
          <h1 className="font-bold text-sm">Futbol Menajeri</h1>
          <p className="text-xs text-slate-400">Kariyer Modu</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-500 font-medium'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <button 
          onClick={() => {
            if (confirm('Tüm kariyer verileriniz silinecek. Emin misiniz?')) {
              useGameStore.getState().resetGame();
              localStorage.removeItem('fm-simulator-save');
              window.location.reload();
            }
          }}
          className="w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-300 bg-red-950/20 hover:bg-red-900/30 border border-red-900/50 py-2 rounded transition-colors"
        >
          <LogOut className="w-3 h-3" /> Kariyeri Sıfırla
        </button>
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          <span>Devam etmek için hazır</span>
        </div>
      </div>
    </aside>
  );
}