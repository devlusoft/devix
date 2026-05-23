import {createSignal, createEffect, Show, onCleanup, type JSX} from 'solid-js'

type Fetchers<T extends Record<string, unknown>> = {
    [K in keyof T]: (() => Promise<T[K]>) | Promise<T[K]>
}

export function AwaitData<T extends Record<string, unknown>>(props: {
    data: Fetchers<T>
    children: (data: T) => JSX.Element
    fallback?: JSX.Element
}) {
    const [data, setData] = createSignal<T | undefined>()

    createEffect(() => {
        let cancelled = false

        Promise.all(
            Object.entries(props.data).map(async ([key, fetcher]) => {
                const val = typeof fetcher === 'function' ? await fetcher() : await fetcher
                return [key, val] as const
            })
        ).then(
            entries => {
                if (!cancelled) setData(() => Object.fromEntries(entries) as unknown as T)
            },
        )

        onCleanup(() => { cancelled = true })
    })

    return (
        <Show when={data() as T} fallback={props.fallback}>
            {d => props.children(d())}
        </Show>
    )
}
