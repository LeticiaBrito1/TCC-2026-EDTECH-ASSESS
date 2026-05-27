import React, { useState, useRef, useEffect } from "react";
import { Settings, X, SunMoon, ZoomIn, Zap, Crosshair } from "lucide-react";
import { useAccessibility } from "@/lib/AccessibilityContext";

const OPTIONS = [
  {
    key: "highContrast",
    label: "Alto contraste",
    description: "Aumenta o contraste das cores",
    icon: SunMoon,
  },
  {
    key: "largeText",
    label: "Texto grande",
    description: "Aumenta o tamanho das fontes",
    icon: ZoomIn,
  },
  {
    key: "reduceMotion",
    label: "Reduzir animações",
    description: "Remove transições e animações",
    icon: Zap,
  },
  {
    key: "focusVisible",
    label: "Realçar foco",
    description: "Destaca o elemento focado pelo teclado",
    icon: Crosshair,
  },
];

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const { settings, toggle } = useAccessibility();
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCount = Object.values(settings).filter(Boolean).length;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Configurações de acessibilidade"
          className="bg-card border border-border rounded-2xl shadow-2xl w-72 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm text-foreground">Acessibilidade</span>
            <button
              onClick={() => setOpen(false)}
              aria-label="Fechar configurações de acessibilidade"
              className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <ul className="p-3 space-y-1" role="list">
            {OPTIONS.map(({ key, label, description, icon: Icon }) => (
              <li key={key}>
                <button
                  role="switch"
                  aria-checked={settings[key]}
                  aria-label={label}
                  onClick={() => toggle(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    settings[key]
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  </div>
                  {/* Toggle visual */}
                  <div
                    aria-hidden="true"
                    className={`shrink-0 w-9 h-5 rounded-full transition-colors relative ${
                      settings[key] ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                        settings[key] ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        ref={triggerRef}
        onClick={() => setOpen(v => !v)}
        aria-label={open ? "Fechar configurações de acessibilidade" : "Abrir configurações de acessibilidade"}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`relative w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
          open
            ? "bg-primary text-primary-foreground"
            : "bg-card border border-border text-foreground hover:bg-muted"
        }`}
      >
        <Settings className={`w-5 h-5 transition-transform duration-300 ${open ? "rotate-90" : ""}`} aria-hidden="true" />
        {activeCount > 0 && !open && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold"
          >
            {activeCount}
          </span>
        )}
      </button>
    </div>
  );
}
