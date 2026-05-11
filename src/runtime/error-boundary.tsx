import {Component, ComponentType, ReactNode} from "react";
import {ErrorProps} from "../server/types";

interface Props {
    ErrorPage?: ComponentType<ErrorProps>
    children: ReactNode
}

interface State {
    error: ErrorProps | null
}

export class DevixErrorBoundary extends Component<Props, State> {
    state: State = { error: null }

    static getDerivedStateFromError(err: unknown): State {
        if (err instanceof DevixError) {
            return {
                error: {statusCode: err.statusCode, message: err.message}
            }
        }
        return  {
            error: {statusCode: 500, message: err instanceof Error ? err.message : 'Unknown error'}
        }
    }

    render() {
        if (this.state.error && this.props.ErrorPage) {
            return <this.props.ErrorPage {...this.state.error} />
        }
        if (this.state.error) {
            return <h1>{this.state.error.statusCode}</h1>
        }
        return this.props.children
    }
}

export interface DevixErrorOptions {
    code?: string
    data?: unknown
}

const DEVIX_ERROR_BRAND = Symbol.for('@devlusoft/devix.DevixError')

export class DevixError extends Error {
    /**
     * Custom `instanceof` que matchea por brand cross-bundle. Ver nota en
     * `FetchError` para el detalle del dual package hazard.
     */
    static [Symbol.hasInstance](value: unknown): boolean {
        return value !== null && typeof value === 'object' && (value as any)[DEVIX_ERROR_BRAND] === true
    }

    statusCode: number
    code?: string
    data?: unknown
    constructor(statusCode: number, message: string, options?: DevixErrorOptions) {
        super(message)
        this.name = 'DevixError'
        this.statusCode = statusCode
        this.code = options?.code
        this.data = options?.data
        ;(this as any)[DEVIX_ERROR_BRAND] = true
    }
}
