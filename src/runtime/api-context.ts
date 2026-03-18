import type {DevixHandler} from './create-handler'

export class RouteContext {
    readonly params: Record<string, string>
    private _state = new Map<string, unknown>()

    constructor(params: Record<string, string> = {}) {
        this.params = params
    }

    set<T>(key: string, value: T): void {
        this._state.set(key, value)
    }

    get<T>(key: string): T | undefined {
        return this._state.get(key) as T
    }
}

export type RouteResult = Response | Record<string, unknown> | unknown[] | null | void

export type RouteHandler = (ctx: RouteContext, req: Request) => Promise<RouteResult> | RouteResult

export interface MiddlewareModule {
    middleware: (ctx: RouteContext, req: Request) => Promise<Response | null> | Response | null
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
