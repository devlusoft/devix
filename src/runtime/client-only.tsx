import { createComponent, createSignal, lazy, onMount, type Component, type JSX } from "solid-js";

export function ClientOnly(props: { children: JSX.Element; fallback?: JSX.Element }): JSX.Element {
  const [mounted, setMounted] = createSignal(false);
  onMount(() => setMounted(true));
  return mounted() ? props.children : (props.fallback ?? null);
}

export function clientOnly<T extends Component<any>>(
  loader: () => Promise<{ default: T }>
): T & { preload: () => void } {
  const LazyComp = lazy(loader);

  const Comp = ((props: any) => {
    if (typeof window === 'undefined') return null;
    return createComponent(LazyComp, props);
  }) as T & { preload: () => void };

  Comp.preload = () => { loader(); };

  return Comp;
}
