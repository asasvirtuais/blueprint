import { z, ZodType } from 'zod';
export type BlueprintKey = string | symbol;
/**
 * Options for creating a new blueprint.
 * @template P The type of the input properties.
 * @template R The type of the result.
 */
export interface BlueprintOptions<P, R> {
    key?: BlueprintKey;
    description?: string;
    initialImplementation?: (props: P) => R;
}
/**
 * Represents a callable blueprint function with chainable methods for defining its behavior.
 * @template P The type of the input properties.
 * @template R The type of the result.
 */
export interface IBlueprint<P, R> {
    /**
     * Executes the blueprint with the given properties.
     * @param props The input properties for the blueprint.
     * @returns The result of the blueprint's execution.
     */
    (props: P): R;
    readonly key?: BlueprintKey;
    readonly description?: string;
    readonly __isBlueprint: true;
    /**
     * Sets or replaces the core implementation logic of the blueprint.
     * @template NewP The input properties type for the new implementation.
     * @template NewR The result type for the new implementation.
     * @param implementation The function defining the core logic.
     * @returns A new blueprint instance with the specified implementation.
     */
    implement<NewP = P, NewR = R>(this: IBlueprint<P, R>, implementation: (props: NewP) => NewR): IBlueprint<NewP, NewR>;
    mod<ModP = P, ModR = R>(this: IBlueprint<P, R>, modFn: (callable: (previous: (props: P) => R) => IBlueprint<ModP, ModR>) => IBlueprint<ModP, ModR>): IBlueprint<ModP, ModR>;
    more<MoreP = P, MoreR = R>(this: IBlueprint<P, R>, modFn: (callable: (previous: (props: P & MoreP) => R) => IBlueprint<P & MoreP, R & MoreR>) => IBlueprint<P & MoreP, R & MoreR>): IBlueprint<P & MoreP, R & MoreR>;
    /**
     * Adds an input transformation function to the blueprint.
     * Input mappers are applied in reverse order of addition (last added runs first),
     * before defaults, enforcement, and validation.
     * @template NewP The type of the input properties after this transformation.
     * @param transform A function that takes the original properties (P) and returns new properties of type NewP.
     * @returns A new blueprint instance with the input transformation and updated input type.
     */
    input<NewP>(this: IBlueprint<P, R>, transform: (props: P) => NewP): IBlueprint<NewP, R>;
    /**
     * Sets default values for some of the blueprint's properties.
     * These defaults are applied if the properties are not provided at call time.
     * @template K The keys of P for which defaults are being provided.
     * @param defaultsOrProvider An object containing default values for keys K, or a function that returns such an object.
     * @returns A new blueprint instance whose input type reflects that properties in K are now optional.
     */
    defaults<K extends keyof P>(this: IBlueprint<P, R>, defaultsOrProvider: Partial<Pick<P, K>> | ((props: Omit<P, K>) => Partial<Pick<P, K>>)): IBlueprint<Omit<P, K> & Partial<Pick<P, K>>, R>;
    /**
     * Enforces specific values for a subset of the blueprint's properties.
     * These properties will no longer be required at call time, as their values are fixed.
     * @template K The keys of P for which values are being enforced.
     * @param enforcedValues An object containing the values to enforce for keys K.
     * @returns A new blueprint instance whose input type reflects that properties in K are no longer required.
     */
    enforce<K extends keyof P>(this: IBlueprint<P, R>, enforcedValues: Pick<P, K>): IBlueprint<Omit<P, K>, R>;
    /**
     * Adds a transformation function for the output result.
     * Output mappers are applied in the order they are added, after the core implementation.
     * @template NextR The type of the result after this transformation.
     * @param transform A function that takes the current result (R) and original properties (P)
     *                  and returns a new result of type NextR.
     * @returns A new blueprint instance with the output transformation.
     */
    output<NextR>(this: IBlueprint<P, R>, transform: (result: R, originalProps: P) => NextR): IBlueprint<P, NextR>;
    /**
     * Adds a side-effect function to be executed before the core implementation.
     * @param effect A function that takes the (post-defaults, post-enforcement, post-input-mapping, post-props-validation) properties.
     * @returns A new blueprint instance with the 'before' hook.
     */
    before(this: IBlueprint<P, R>, effect: (props: P) => void): IBlueprint<P, R>;
    /**
     * Adds a side-effect function to be executed after the core implementation, output mapping, and result validation.
     * @param effect A function that takes the final (validated) result and the (validated) properties.
     * @returns A new blueprint instance with the 'after' hook.
     */
    after(this: IBlueprint<P, R>, effect: (result: R, props: P) => void): IBlueprint<P, R>;
    /**
     * Modifies the blueprint to ensure its result is a Promise.
     * If the implementation alreadabley returns a Promise, it's preserved.
     * @returns A new blueprint instance that returns Promise<R>.
     */
    toAsync(this: IBlueprint<P, R>): IBlueprint<P, Promise<R>>;
    /**
     * Modifies the blueprint to return void. The actual result is discarded.
     * @returns A new blueprint instance that returns void.
     */
    toVoid(this: IBlueprint<P, R>): IBlueprint<P, void>;
    /**
     * Composes this blueprint with another blueprint or a function.
     * The result of this blueprint is passed as input to the next one.
     * @template NextR The result type of the next blueprint or function.
     * @param nextBlueprintOrFn Another blueprint (IBlueprint<R, NextR>) or a function ((result: R) => NextR).
     * @returns A new blueprint instance representing the sequential composition.
     */
    pipe<NextR>(this: IBlueprint<P, R>, nextBlueprintOrFn: IBlueprint<R, NextR> | ((result: R) => NextR)): IBlueprint<P, NextR>;
    /**
     * Applies a Zod schema to validate the input properties.
     * The blueprint's input type `P` will be inferred from the schema.
     * @template S The Zod schema type for props.
     * @param schema The Zod schema for validating input properties.
     * @returns A new blueprint instance with props validation and an updated input type.
     */
    zProps<S extends ZodType<any>>(this: IBlueprint<P, R>, schema: S): IBlueprint<z.infer<S>, R>;
    /**
     * Applies a Zod schema to validate the result.
     * The blueprint's result type `R` will be inferred from the schema.
     * @template S The Zod schema type for the result.
     * @param schema The Zod schema for validating the result.
     * @returns A new blueprint instance with result validation and an updated result type.
     */
    zResult<S extends ZodType<any>>(this: IBlueprint<P, R>, schema: S): IBlueprint<P, z.infer<S>>;
}
/**
 * Creates a new blueprint.
 * Can be called with an initial implementation function or an options object.
 * @template P The type of the input properties. Defaults to `unknown`.
 * @template R The type of the result. Defaults to `void`.
 * @param optionsOrImplementation Optional configuration for the blueprint, or an initial implementation function.
 * @returns A new IBlueprint instance.
 */
export default function blueprint<P, R>(initialImplementation: (props: P) => R): IBlueprint<P, R>;
declare function blueprint<P = unknown, R = void>(options?: BlueprintOptions<P, R>): IBlueprint<P, R>;
declare namespace blueprint {
    var from: typeof import(".").from;
}
export default blueprint;
type MapKeysToParams<F extends (...args: any[]) => any, K extends readonly string[]> = {
    [Index in keyof K as K[Index] extends string ? K[Index] : never]: Index extends keyof Parameters<F> ? Parameters<F>[Index] : never;
};
type Simplify<T> = {
    [K in keyof T]: T[K];
} & {};
/**
 * Cria um Blueprint a partir de uma função normal, mapeando parâmetros posicionais para um objeto
 * @template F O tipo da função original
 * @template K Array de strings para as chaves dos parâmetros
 * @param fn A função original que aceita parâmetros posicionais
 * @param keys Array de strings que serão as chaves do objeto de entrada do Blueprint
 * @returns Um Blueprint que aceita um objeto com as chaves especificadas
 */
export declare function from<F extends (...args: any[]) => any, const K extends readonly string[]>(fn: F, keys: K): IBlueprint<Simplify<MapKeysToParams<F, K>>, ReturnType<F>>;
declare module './index' {
    namespace blueprint {
        function from<F extends (...args: any[]) => any, const K extends readonly string[]>(fn: F, keys: K): IBlueprint<Simplify<MapKeysToParams<F, K>>, ReturnType<F>>;
    }
}
//# sourceMappingURL=index.d.ts.map