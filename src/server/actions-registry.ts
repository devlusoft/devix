const registry = new Map<string, Function>();

export function registerAction(id: string, fn: Function) {
    registry.set(id, fn);
}

export function getAction(id: string) {
    return registry.get(id);
}
