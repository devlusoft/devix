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

export class DevixError extends Error {
    statusCode: number
    constructor(statusCode: number, message: string) {
        super(message)
        this.statusCode = statusCode
    }
}
