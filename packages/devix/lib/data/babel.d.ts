declare module '@babel/traverse' {
  const traverse: (ast: unknown, visitors: Record<string, (path: any) => void>) => void
  export default traverse
  export type NodePath<T = unknown> = any
}

declare module '@babel/generator' {
  interface GeneratorResult {
    code: string
    map: unknown
  }
  const generate: (ast: unknown, options?: Record<string, unknown>, code?: string) => GeneratorResult
  export default generate
}
