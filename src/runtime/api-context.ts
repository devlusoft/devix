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

export type RouteHandler = (ctx: RouteContext, request: Request) => Promise<Response | null> | Response | null

export interface MiddlewareModule {
    middleware: (ctx: RouteContext, request: Request) => Promise<Response | null> | Response | null
}

export interface RouteModule {
    GET?: RouteHandler
    POST?: RouteHandler
    PUT?: RouteHandler
    PATCH?: RouteHandler
    DELETE?: RouteHandler
    HEAD?: RouteHandler
    OPTIONS?: RouteHandler
}