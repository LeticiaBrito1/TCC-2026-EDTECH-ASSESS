import React, { createContext, useContext, useState, useEffect } from "react";

const STORAGE_KEY = "edtech_a11y_settings";

const defaults = {
  highContrast: false,
  largeText: false,
  reduceMotion: false,
  focusVisible: false,
  audioReadAloud: false,
};

const AccessibilityContext = createContext(null);

export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("a11y-high-contrast", settings.highContrast);
    root.classList.toggle("a11y-large-text", settings.largeText);
    root.classList.toggle("a11y-reduce-motion", settings.reduceMotion);
    root.classList.toggle("a11y-focus-visible", settings.focusVisible);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignora falha de storage.
    }
  }, [settings]);

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <AccessibilityContext.Provider value={{ settings, toggle }}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export const useAccessibility = () => useContext(AccessibilityContext);
