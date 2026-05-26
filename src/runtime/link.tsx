import {type Component, type JSX, splitProps} from 'solid-js'

interface LinkProps extends JSX.AnchorHTMLAttributes<HTMLAnchorElement> {
    href: string
    viewTransition?: boolean
}

export const Link: Component<LinkProps> = (props) => {
    const [local, rest] = splitProps(props, ['viewTransition'])
    return <a {...rest} />
}
