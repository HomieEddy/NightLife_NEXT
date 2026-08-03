"use client";

/**
 * Client-side guest session + cart state.
 * Persisted to sessionStorage so the flow survives route changes and refreshes.
 * Live authorization comes from the signed guest cookie; this state is only UI/cart continuity.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartLine, OrderItemModifier, MenuItem, Venue } from "@/lib/types";
import { uid } from "@/features/shared/id";
import { orderLineSubtotal } from "@/lib/order-line";

export interface GuestTableInfo {
  tableId: string;
  tableCode: string;
  tableLabel: string;
  zoneId: string;
  zoneName: string;
}

export type ClosureStatus = "none" | "requested" | "closed";

interface GuestState {
  table: GuestTableInfo | null;
  /** Snapshot from the QR landing lookup — a public, unauthenticated read (see findTableByQrSlug). */
  venue: Venue | null;
  guestName: string;
  sessionId: string | null;
  approved: boolean;
  cart: CartLine[];
  lastOrderId: string | null;
  closureStatus: ClosureStatus;
}

interface GuestContextValue extends GuestState {
  startSession: (table: GuestTableInfo, venue: Venue, guestName: string, sessionId: string) => void;
  approve: () => void;
  reset: () => void;
  addToCart: (item: MenuItem, quantity: number, modifiers: OrderItemModifier[], note?: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  clearCart: () => void;
  setLastOrderId: (orderId: string) => void;
  setClosureStatus: (status: ClosureStatus) => void;
  cartCount: number;
  cartSubtotal: number;
}

const STORAGE_KEY = "nln-guest-state";

const initialState: GuestState = {
  table: null,
  venue: null,
  guestName: "",
  sessionId: null,
  approved: false,
  cart: [],
  lastOrderId: null,
  closureStatus: "none",
};

const GuestContext = createContext<GuestContextValue | null>(null);

export function GuestProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuestState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setState(JSON.parse(raw) as GuestState);
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  // Persist debounced — the cart holds full MenuItem objects and steppers
  // fire per keystroke; writing JSON.stringify(state) on every change was a
  // per-keystroke serialization of the whole cart.
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // quota exceeded — ignore, state still lives in memory
      }
    }, 500);
    return () => clearTimeout(t);
  }, [state, hydrated]);

  const startSession = useCallback(
    (table: GuestTableInfo, venue: Venue, guestName: string, sessionId: string) => {
      setState({ ...initialState, table, venue, guestName, sessionId });
    },
    [],
  );

  const approve = useCallback(() => setState((s) => ({ ...s, approved: true })), []);
  const reset = useCallback(() => setState(initialState), []);

  const addToCart = useCallback(
    (item: MenuItem, quantity: number, modifiers: OrderItemModifier[], note?: string) => {
      setState((s) => ({
        ...s,
        cart: [...s.cart, { lineId: uid("line"), menuItem: item, quantity, modifiers, note }],
      }));
    },
    [],
  );

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setState((s) => ({
      ...s,
      cart:
        quantity <= 0
          ? s.cart.filter((l) => l.lineId !== lineId)
          : s.cart.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
    }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setState((s) => ({ ...s, cart: s.cart.filter((l) => l.lineId !== lineId) }));
  }, []);

  const clearCart = useCallback(() => setState((s) => ({ ...s, cart: [] })), []);

  const setLastOrderId = useCallback(
    (orderId: string) => setState((s) => ({ ...s, lastOrderId: orderId })),
    [],
  );

  const setClosureStatus = useCallback(
    (status: ClosureStatus) => setState((s) => ({ ...s, closureStatus: status })),
    [],
  );

  const cartCount = useMemo(() => state.cart.reduce((n, l) => n + l.quantity, 0), [state.cart]);
  const cartSubtotal = useMemo(
    () =>
      state.cart.reduce(
        (sum, line) =>
          sum + orderLineSubtotal(line.menuItem.price, line.quantity, line.modifiers),
        0,
      ),
    [state.cart],
  );

  const value: GuestContextValue = {
    ...state,
    startSession,
    approve,
    reset,
    addToCart,
    updateQuantity,
    removeLine,
    clearCart,
    setLastOrderId,
    setClosureStatus,
    cartCount,
    cartSubtotal,
  };

  return <GuestContext.Provider value={value}>{children}</GuestContext.Provider>;
}

export function useGuest(): GuestContextValue {
  const ctx = useContext(GuestContext);
  if (!ctx) throw new Error("useGuest must be used within GuestProvider");
  return ctx;
}
