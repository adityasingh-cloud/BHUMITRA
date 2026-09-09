import { useRef, useSyncExternalStore } from "react";

export function useSyncExternalStoreWithSelector<TSnapshot, TSelection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => TSnapshot,
  getServerSnapshot: () => TSnapshot,
  selector: (snapshot: TSnapshot) => TSelection,
  isEqual: (a: TSelection, b: TSelection) => boolean = Object.is,
): TSelection {
  const selected = selector(
    useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
  );
  const previous = useRef(selected);
  if (isEqual(previous.current, selected)) return previous.current;
  previous.current = selected;
  return selected;
}