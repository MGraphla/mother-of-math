import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

interface DrawerContextValue {
  open: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  /** False outside a provider, so headers can fall back to a back button. */
  hasDrawer: boolean;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export const DrawerProvider = ({ children }: PropsWithChildren) => {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openDrawer, closeDrawer, toggleDrawer, hasDrawer: true }),
    [open, openDrawer, closeDrawer, toggleDrawer],
  );

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};

/** Returns no-ops outside a DrawerProvider so screens can render standalone. */
export const useDrawer = (): DrawerContextValue => {
  const ctx = useContext(DrawerContext);
  return (
    ctx ?? {
      open: false,
      openDrawer: () => {},
      closeDrawer: () => {},
      toggleDrawer: () => {},
      hasDrawer: false,
    }
  );
};
