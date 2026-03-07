import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { appClient } from "@/api/appClient";
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
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    appClient.auth.me().then(setUser).catch(() => {});
  }, []);

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
        fixed lg:sticky top-0 left-0 z-50 h-screen w-72
        flex flex-col transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `} style={{ background: "hsl(218, 75%, 18%)" }}>
        <div className="p-6 border-b" style={{ borderColor: "hsl(218, 75%, 26%)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "hsl(206, 72%, 55%)" }}>
              <ScanLine className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">EdTech Assess</h1>
              <p className="text-xs" style={{ color: "hsl(206, 72%, 75%)" }}>Plataforma de Avaliações</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
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
          <div className="p-4 border-t" style={{ borderColor: "hsl(218, 75%, 26%)" }}>
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
                <DropdownMenuItem onClick={() => appClient.auth.logout()}>
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
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <ScanLine className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-foreground">EdTech Assess</span>
            </div>
            <div className="w-10" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
