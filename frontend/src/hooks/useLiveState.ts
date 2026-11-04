import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

/** Ignores asynchronous state updates after the owning view unmounts. */
export function useLiveState<T>(initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(initial);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const set = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    if (live.current) setValue(next);
  }, []);
  return [value, set];
}
