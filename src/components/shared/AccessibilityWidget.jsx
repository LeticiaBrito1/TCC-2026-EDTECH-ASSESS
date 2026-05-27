import React, { useState, useRef, useEffect, useCallback } from "react";
import { Settings, X, SunMoon, ZoomIn, Zap, Crosshair, Volume2, VolumeX, Square } from "lucide-react";
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
    description: "Destaca visualmente o elemento focado pelo teclado (navegação por Tab)",
    icon: Crosshair,
  },
  {
    key: "audioReadAloud",
    label: "Leitura em voz alta",
    description: "Lê em voz alta o conteúdo ao clicar nos elementos",
    icon: Volume2,
  },
];

// ── Utilitários de fala ───────────────────────────────────────

const getVoice = () => {
  const voices = window.speechSynthesis?.getVoices() || [];
  return (
    voices.find(v => v.lang === "pt-BR") ||
    voices.find(v => v.lang.startsWith("pt")) ||
    null
  );
};

const speak = (text) => {
  if (!window.speechSynthesis || !text?.trim()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.trim());
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  const voice = getVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
};

const stopSpeech = () => window.speechSynthesis?.cancel();

const getReadableText = (el) => {
  if (!el) return "";
  // Prioriza aria-label > aria-labelledby > alt > placeholder > textContent
  if (el.getAttribute("aria-label")) return el.getAttribute("aria-label");
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ref.textContent;
  }
  if (el.tagName === "IMG" && el.alt) return el.alt;
  if (el.placeholder) return el.placeholder;
  const text = el.innerText || el.textContent || "";
  return text.slice(0, 300);
};

const READABLE_SELECTOR = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "button", "a", "label", "li",
  "[role='button']", "[role='link']", "[role='menuitem']",
  "input", "select", "textarea",
  "td", "th",
].join(",");

// ── Componente principal ──────────────────────────────────────

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { settings, toggle } = useAccessibility();
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  // ── Leitura ao clicar (modo áudio) ──────────────────────────
  const handleClick = useCallback((e) => {
    const el = e.target.closest(READABLE_SELECTOR);
    if (!el) return;
    // Não lê o próprio widget de acessibilidade
    if (el.closest("[data-a11y-widget]")) return;
    const text = getReadableText(el);
    if (text) speak(text);
  }, []);

  useEffect(() => {
    if (!settings.audioReadAloud) {
      stopSpeech();
      document.removeEventListener("click", handleClick, true);
      document.documentElement.classList.remove("a11y-audio");
      return;
    }
    document.addEventListener("click", handleClick, true);
    document.documentElement.classList.add("a11y-audio");

    const synth = window.speechSynthesis;
    if (synth) {
      const check = setInterval(() => setIsSpeaking(synth.speaking), 200);
      return () => {
        clearInterval(check);
        document.removeEventListener("click", handleClick, true);
        document.documentElement.classList.remove("a11y-audio");
      };
    }
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.documentElement.classList.remove("a11y-audio");
    };
  }, [settings.audioReadAloud, handleClick]);

  // ── Lê o conteúdo principal da página ───────────────────────
  const readPage = () => {
    const main = document.querySelector("main") || document.body;
    const headings = Array.from(main.querySelectorAll("h1,h2,h3,p,li"))
      .map(el => el.innerText || el.textContent || "")
      .filter(t => t.trim())
      .slice(0, 30)
      .join(". ");
    speak(headings || "Sem conteúdo para ler.");
  };

  // ── Fecha ao clicar fora / Escape ────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e) => {
      if (!panelRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target))
        setOpen(false);
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
    <div data-a11y-widget className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Configurações de acessibilidade"
          className="bg-card border border-border rounded-2xl shadow-2xl w-76 overflow-hidden"
          style={{ width: "300px" }}
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
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{description}</p>
                  </div>
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

          {/* Controles de áudio — só aparecem quando o modo está ativo */}
          {settings.audioReadAloud && (
            <div className="px-3 pb-3 space-y-2">
              <div className="h-px bg-border" />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={readPage}
                  aria-label="Ler conteúdo da página em voz alta"
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Volume2 className="w-4 h-4" aria-hidden="true" />
                  Ler página
                </button>
                <button
                  onClick={stopSpeech}
                  aria-label="Parar leitura em voz alta"
                  disabled={!isSpeaking}
                  className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-40"
                >
                  <Square className="w-4 h-4" aria-hidden="true" />
                  Parar
                </button>
              </div>
              {isSpeaking && (
                <p role="status" aria-live="polite" className="text-xs text-primary text-center animate-pulse">
                  Lendo em voz alta...
                </p>
              )}
              <p className="text-xs text-muted-foreground text-center">
                Clique em qualquer texto para ouvi-lo
              </p>
            </div>
          )}
        </div>
      )}

      {/* Botão flutuante */}
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
