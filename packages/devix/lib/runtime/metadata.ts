import {LayoutModule, PageModule} from "../server";
import {GuardContext, Metadata, Viewport} from "../types"

export interface ResolvedMeta {
    metadata: Metadata
    viewport?: Viewport
}

export async function resolveMetadata(module: PageModule | LayoutModule, ctx: GuardContext & {
    loaderData: unknown
}): Promise<ResolvedMeta> {
    const metadata = module.generateMetadata
        ? await module.generateMetadata(ctx)
        : module.metadata ?? {}

    const viewport = module.generateViewport
        ? await module.generateViewport(ctx)
        : module.viewport

    return {metadata, viewport}
}

export function mergeMetadata(...sources: (Metadata | null | undefined)[]): Metadata {
    const result: Metadata = {}

    for (const source of sources) {
        if (!source) continue
        const { og, twitter, ...rest } = source
        Object.assign(result, rest)
        if (og) result.og = { ...result.og, ...og }
        if (twitter) result.twitter = { ...result.twitter, ...twitter }
    }

    return result
}