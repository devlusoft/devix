import { Metadata, MetadataIcon, Viewport } from "../types";
import { ReactNode } from "react";

type MetaTag =
    | { tag: 'title'; children: string }
    | { tag: 'meta'; name?: string; property?: string; content: string }
    | { tag: 'link'; rel: string; href: string; hrefLang?: string; type?: string; sizes?: string }

function collectTags(metadata: Metadata, viewport?: Viewport): MetaTag[] {
    const tags: MetaTag[] = []

    if (metadata.title)
        tags.push({ tag: 'title', children: metadata.title })
    if (metadata.description)
        tags.push({ tag: 'meta', name: 'description', content: metadata.description })
    if (metadata.keywords?.length)
        tags.push({ tag: 'meta', name: 'keywords', content: metadata.keywords.join(', ') })

    const ogTitle = metadata.og?.title ?? metadata.title
    if (ogTitle) tags.push({ tag: 'meta', property: 'og:title', content: ogTitle })
    const ogDesc = metadata.og?.description ?? metadata.description
    if (ogDesc) tags.push({ tag: 'meta', property: 'og:description', content: ogDesc })
    if (metadata.og?.image) tags.push({ tag: 'meta', property: 'og:image', content: metadata.og.image })
    if (metadata.og?.type) tags.push({ tag: 'meta', property: 'og:type', content: metadata.og.type })
    if (metadata.og?.url) tags.push({ tag: 'meta', property: 'og:url', content: metadata.og.url })

    const twTitle = metadata.twitter?.title ?? metadata.title
    if (twTitle) tags.push({ tag: 'meta', name: 'twitter:title', content: twTitle })
    const twDesc = metadata.twitter?.description ?? metadata.description
    if (twDesc) tags.push({ tag: 'meta', name: 'twitter:description', content: twDesc })
    if (metadata.twitter?.card) tags.push({
        tag: 'meta', name: 'twitter:card', content:
            metadata.twitter.card
    })
    if (metadata.twitter?.image) tags.push({
        tag: 'meta', name: 'twitter:image', content:
            metadata.twitter.image
    })
    if (metadata.twitter?.creator) tags.push({
        tag: 'meta', name: 'twitter:creator', content:
            metadata.twitter.creator
    })

    if (metadata.canonical) tags.push({ tag: 'link', rel: 'canonical', href: metadata.canonical })
    if (metadata.robots) tags.push({ tag: 'meta', name: 'robots', content: metadata.robots })
    if (metadata.alternates) {
        for (const [lang, href] of Object.entries(metadata.alternates))
            tags.push({ tag: 'link', rel: 'alternate', href, hrefLang: lang })
    }

    if (metadata.icons) {
        const raw = Array.isArray(metadata.icons) ? metadata.icons : [metadata.icons]
        for (const icon of raw) {
            const resolved: MetadataIcon = typeof icon === 'string' ? { href: icon } : icon
            tags.push({
                tag: 'link',
                rel: resolved.rel ?? 'icon',
                href: resolved.href,
                ...(resolved.type && { type: resolved.type }),
                ...(resolved.sizes && { sizes: resolved.sizes }),
            })
        }
    }

    if (viewport) {
        const parts: string[] = []
        if (viewport.width !== undefined) parts.push(`width=${viewport.width}`)
        if (viewport.initialScale !== undefined) parts.push(`initial-scale=${viewport.initialScale}`)
        if (viewport.maximumScale !== undefined) parts.push(`maximum-scale=${viewport.maximumScale}`)
        if (viewport.userScalable !== undefined) parts.push(`user-scalable=${viewport.userScalable ? 'yes' :
            'no'}`)
        if (parts.length) tags.push({ tag: 'meta', name: 'viewport', content: parts.join(', ') })
        if (viewport.themeColor) tags.push({
            tag: 'meta', name: 'theme-color', content: viewport.themeColor
        })
    }

    return tags
}

export function HeadSlot({ metadata, viewport }: { metadata: Metadata | null, viewport?: Viewport }) {
    if (typeof window === 'undefined' || !metadata) return null
    return <>{buildHeadNodes(metadata, viewport)}</>
}

export function buildHeadNodes(metadata: Metadata, viewport?: Viewport): ReactNode {
    const tags = collectTags(metadata, viewport)

    return <>
        {tags.map((t, i) => {
            if (t.tag === 'title') return <title key={i}>{t.children}</title>
            if (t.tag === 'link') return <link key={i} rel={t.rel} href={t.href} hrefLang={t.hrefLang} type={t.type} sizes={t.sizes} />
            return <meta key={i} name={t.name} property={t.property} content={t.content} />
        })}
    </>
}