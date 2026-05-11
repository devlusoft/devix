/**
 * Tipos del contrato Standard Schema v1 — https://standardschema.dev
 *
 * Implementado por Zod 3.24+, Valibot, ArkType, Effect Schema y otros.
 * devix usa este contrato para validar bodies de handlers de forma agnóstica
 * al validador.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

export namespace StandardSchemaV1 {
    export interface Props<Input = unknown, Output = Input> {
        readonly version: 1
        readonly vendor: string
        readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
        readonly types?: Types<Input, Output>
    }

    export type Result<Output> = SuccessResult<Output> | FailureResult

    export interface SuccessResult<Output> {
        readonly value: Output
        readonly issues?: undefined
    }

    export interface FailureResult {
        readonly issues: readonly Issue[]
    }

    export interface Issue {
        readonly message: string
        readonly path?: readonly (PropertyKey | PathSegment)[] | undefined
    }

    export interface PathSegment {
        readonly key: PropertyKey
    }

    export interface Types<Input = unknown, Output = Input> {
        readonly input: Input
        readonly output: Output
    }

    export type InferInput<S> =
        S extends StandardSchemaV1<infer I, any> ? I : never

    export type InferOutput<S> =
        S extends StandardSchemaV1<any, infer O> ? O : never
}
