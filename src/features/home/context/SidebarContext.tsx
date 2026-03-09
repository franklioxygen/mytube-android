import React, { createContext, useCallback, useContext, useState } from 'react';

export type SidebarFilter =
  | { type: 'tag'; value: string }
  | { type: 'author'; value: string }
  | null;

interface SidebarContextValue {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  filter: SidebarFilter;
  setFilter: (f: SidebarFilter) => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<SidebarFilter>(null);

  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <SidebarContext.Provider value={{ isOpen, toggle, close, filter, setFilter }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
