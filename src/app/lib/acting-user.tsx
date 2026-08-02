import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { loginSession } from "@/api/client";
import {
  ACTING_USER_CHANGED_EVENT,
  DEFAULT_PROTOTYPE_USER_ID,
  getPrototypeUser,
  readActingUserId,
  writeActingUserId,
  type PrototypeUser,
} from "./prototype-users";
import {
  summarizeRoleAffordances,
  type RoleAffordanceSummary,
} from "./role-affordances";

type ActingUserContextValue = {
  userId: string;
  user: PrototypeUser;
  affordances: RoleAffordanceSummary;
  setActingUserId: (id: string) => void;
  sessionReady: boolean;
  sessionError: string | null;
};

const ActingUserContext = createContext<ActingUserContextValue | null>(null);

async function syncServerSession(userId: string): Promise<void> {
  await loginSession(userId);
}

export function ActingUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState(DEFAULT_PROTOTYPE_USER_ID);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
    setUserId(readActingUserId());
    const sync = () => setUserId(readActingUserId());
    window.addEventListener("storage", sync);
    window.addEventListener(ACTING_USER_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ACTING_USER_CHANGED_EVENT, sync);
    };
  }, []);

  // Bind cookie session whenever the acting user changes (prototype IdP-lite).
  useEffect(() => {
    let cancelled = false;
    setSessionReady(false);
    setSessionError(null);
    syncServerSession(userId)
      .then(() => {
        if (!cancelled) setSessionReady(true);
      })
      .catch((err) => {
        if (!cancelled) {
          setSessionError(
            err instanceof Error ? err.message : "Session login failed",
          );
          setSessionReady(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const value = useMemo<ActingUserContextValue>(() => {
    const user =
      getPrototypeUser(userId) ??
      getPrototypeUser(DEFAULT_PROTOTYPE_USER_ID)!;
    return {
      userId: user.id,
      user,
      affordances: summarizeRoleAffordances(user),
      sessionReady,
      sessionError,
      setActingUserId: (id: string) => {
        writeActingUserId(id);
        // writeActingUserId dispatches; sync listener updates state. Set eagerly
        // so the provider updates even if the event is missed.
        if (getPrototypeUser(id)) setUserId(id);
      },
    };
  }, [userId, sessionReady, sessionError]);

  return (
    <ActingUserContext.Provider value={value}>
      {children}
    </ActingUserContext.Provider>
  );
}

export function useActingUser(): ActingUserContextValue {
  const ctx = useContext(ActingUserContext);
  if (!ctx) {
    throw new Error("useActingUser must be used within ActingUserProvider");
  }
  return ctx;
}

/**
 * Soft read for components that may render outside the provider (tests /
 * isolated embeds). Falls back to localStorage / default.
 */
export function useActingUserOptional(): ActingUserContextValue {
  const ctx = useContext(ActingUserContext);
  const [fallbackId, setFallbackId] = useState(DEFAULT_PROTOTYPE_USER_ID);

  useEffect(() => {
    if (ctx) return;
    setFallbackId(readActingUserId());
    const sync = () => setFallbackId(readActingUserId());
    window.addEventListener("storage", sync);
    window.addEventListener(ACTING_USER_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ACTING_USER_CHANGED_EVENT, sync);
    };
  }, [ctx]);

  return useMemo(() => {
    if (ctx) return ctx;
    const user =
      getPrototypeUser(fallbackId) ??
      getPrototypeUser(DEFAULT_PROTOTYPE_USER_ID)!;
    return {
      userId: user.id,
      user,
      affordances: summarizeRoleAffordances(user),
      sessionReady: false,
      sessionError: null,
      setActingUserId: (id: string) => {
        writeActingUserId(id);
        if (getPrototypeUser(id)) setFallbackId(id);
      },
    };
  }, [ctx, fallbackId]);
}
