import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appClient } from "@/api/appClient";
import { useAuth } from "@/lib/AuthContext";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  FileQuestion,
  ClipboardCheck,
  BarChart3,
  Menu,
  LogOut,
  ScanLine,
  ChevronDown,
  Bell,
  UserCircle,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

const navItems = [
  { name: "Painel", page: "Dashboard", icon: LayoutDashboard },
  { name: "Turmas", page: "Turmas", icon: Users },
  { name: "Disciplinas", page: "Disciplinas", icon: BookOpen },
  { name: "Alunos", page: "Alunos", icon: GraduationCap },
  { name: "Questões", page: "Questoes", icon: FileQuestion },
  { name: "Avaliações", page: "Avaliacoes", icon: ClipboardCheck },
  { name: "Correção", page: "Correcao", icon: ScanLine },
  { name: "Relatórios", page: "Relatorios", icon: BarChart3 },
  { name: "Pagamento", page: "Pagamento", icon: CreditCard },
];

export default function Layout({ children, currentPageName }) {
  const { user: authUser, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    setUser(authUser || null);
  }, [authUser]);

  useEffect(() => {
    if (!authUser) return undefined;

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(intervalId);
  }, [authUser]);

  const loadNotifications = async () => {
    try {
      const result = await appClient.notifications.list(10);
      setNotifications(result.items || []);
      setUnreadNotifications(Number(result.unread || 0));
    } catch {
      // Ignora falha silenciosamente para não quebrar layout.
    }
  };

  const markAsRead = async (id) => {
    try {
      await appClient.notifications.markAsRead(id);
      await loadNotifications();
    } catch {
      // Ignora falha de marcação.
    }
  };

  const markAllAsRead = async () => {
    try {
      await appClient.notifications.markAllAsRead();
      await loadNotifications();
    } catch {
      // Ignora falha de marcação em lote.
    }
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72
        flex flex-col overflow-hidden transition-transform duration-300 ease-in-out
        lg:sticky lg:top-0 lg:h-screen
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ background: "hsl(218, 75%, 18%)" }}>
        <div className="shrink-0 border-b p-6" style={{ borderColor: "hsl(218, 75%, 26%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center bg-white">
              <img src="/logoEDTECH.png" alt="EdTech Assess" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">EdTech Assess</h1>
              <p className="text-xs" style={{ color: "hsl(206, 72%, 75%)" }}>Plataforma de Avaliações</p>
            </div>
          </div>
        </div>

        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {navItems.map((item) => {
            const isActive = currentPageName === item.page;
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                  transition-all duration-200
                  ${isActive
                    ? 'text-white shadow-lg'
                    : 'hover:text-white'
                  }
                `}
                style={isActive
                  ? { background: "hsl(206, 72%, 55%)" }
                  : { color: "hsl(210, 40%, 75%)" }
                }
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "hsl(218, 75%, 26%)"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        {user && (
          <div className="shrink-0 border-t p-4" style={{ borderColor: "hsl(218, 75%, 26%)" }}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-between w-full px-3 py-2 mb-2 rounded-xl transition-colors"
                  style={{ color: "hsl(210, 40%, 85%)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "hsl(218, 75%, 26%)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <Bell className="w-4 h-4" aria-hidden="true" />
                    Notificações
                    {unreadNotifications > 0 && <span className="sr-only">({unreadNotifications} não lidas)</span>}
                  </span>
                  {unreadNotifications > 0 ? (
                    <span aria-hidden="true" className="text-xs px-2 py-0.5 rounded-full bg-destructive text-white">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "hsl(210, 20%, 70%)" }}>0</span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="px-2 py-1.5 text-sm font-medium flex items-center justify-between">
                  <span>Notificações</span>
                  {unreadNotifications > 0 && (
                    <button className="text-xs text-primary" onClick={markAllAsRead}>
                      Marcar todas
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Sem notificações.</div>
                ) : (
                  notifications.map((item) => (
                    <DropdownMenuItem key={item.id} onClick={() => markAsRead(item.id)} className="items-start">
                      <div className="space-y-1 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          {!item.read_at && <Badge variant="secondary" className="text-[10px]">Nova</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 w-full px-3 py-2 rounded-xl transition-colors"
                  style={{ color: "hsl(210, 40%, 85%)" }}
                  onMouseEnter={e => e.currentTarget.style.background = "hsl(218, 75%, 26%)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-sm font-semibold text-white" style={{ background: "hsl(206, 72%, 55%)" }}>
                      {getInitials(user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
                    <p className="text-xs truncate" style={{ color: "hsl(206, 72%, 75%)" }}>{user.email}</p>
                  </div>
                  <ChevronDown className="w-4 h-4" style={{ color: "hsl(206, 72%, 75%)" }} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link to={createPageUrl("Perfil")} className="flex items-center cursor-pointer">
                    <UserCircle className="w-4 h-4 mr-2" />
                    Meu Perfil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar mobile */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/80 backdrop-blur-lg border-b border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" aria-label="Abrir menu de navegação" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" aria-hidden="true" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center" aria-hidden="true">
                <ScanLine className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">EdTech Assess</span>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={unreadNotifications > 0 ? `Notificações: ${unreadNotifications} não lidas` : "Notificações"}>
                  <Bell className="w-5 h-5" aria-hidden="true" />
                  {unreadNotifications > 0 && (
                    <span aria-hidden="true" className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <div className="px-2 py-1.5 text-sm font-medium flex items-center justify-between">
                  <span>Notificações</span>
                  {unreadNotifications > 0 && (
                    <button className="text-xs text-primary" onClick={markAllAsRead}>
                      Marcar todas
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Sem notificações.</div>
                ) : (
                  notifications.map((item) => (
                    <DropdownMenuItem key={item.id} onClick={() => markAsRead(item.id)} className="items-start">
                      <div className="space-y-1 py-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.title}</span>
                          {!item.read_at && <Badge variant="secondary" className="text-[10px]">Nova</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.message}</p>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
