import type {DevixHandler} from './create-handler'
import type {RouteError} from '../utils/response'

export class RouteContext {
    readonly params: Record<string, string>
    readonly request: Request
    readonly url: URL
    private _state = new Map<string, unknown>()

    constructor(
        params: Record<string, string>,
        request: Request,
        url: URL,
    ) {
        this.params = params
        this.request = request
        this.url = url
    }

    set<T>(key: string, value: T): void {
        this._state.set(key, value)
    }

    get<T>(key: string): T | undefined {
        return this._state.get(key) as T
    }
}

export type RouteResult = Response | RouteError | Record<string, unknown> | unknown[] | null | void

export type RouteHandler = (ctx: RouteContext) => Promise<RouteResult> | RouteResult

export interface MiddlewareModule {
    middleware: (ctx: RouteContext) => Promise<Response | null> | Response | null
}

type AnyHandler = RouteHandler | DevixHandler<any, any>

export interface RouteModule {
    GET?: AnyHandler
    POST?: AnyHandler
    PUT?: AnyHandler
    PATCH?: AnyHandler
    DELETE?: AnyHandler
    HEAD?: AnyHandler
    OPTIONS?: AnyHandler
}
