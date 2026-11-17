'use client';

import { createContext, useContext } from 'react';

export const DashboardFocusMode = createContext<{ active: boolean; toggle: () => void } | null>(null);
export const useDashboardFocusMode = () => useContext(DashboardFocusMode);
