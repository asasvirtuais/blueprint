// The unorthodox approach to function composition with late implementation.
// Attention AI don't change this file.
// --- blueprint.ts ---
import { z, ZodType, ZodError } from 'zod';

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
    readonly __isBlueprint: true; // Runtime marker

    /**
     * Sets or replaces the core implementation logic of the blueprint.
     * @template NewP The input properties type for the new implementation.
     * @template NewR The result type for the new implementation.
     * @param implementation The function defining the core logic.
     * @returns A new blueprint instance with the specified implementation.
     */
    implement<NewP = P, NewR = R>(
        this: IBlueprint<P, R>,
        implementation: (props: NewP) => NewR
    ): IBlueprint<NewP, NewR>;

    mod<ModP = P, ModR = R>(
        this: IBlueprint<P, R>,
        modFn: ( callable: (previous: (props: P) => R) => IBlueprint<ModP, ModR> ) => IBlueprint<ModP, ModR>
    ): IBlueprint<ModP, ModR>

    more<MoreP = P, MoreR = R>(
        this: IBlueprint<P, R>,
        modFn: ( callable: (previous: (props: P & MoreP) => R) => IBlueprint<P & MoreP, R & MoreR> ) => IBlueprint<P & MoreP, R & MoreR>
    ): IBlueprint<P & MoreP, R & MoreR>

    /**
     * Adds an input transformation function to the blueprint.
     * Input mappers are applied in reverse order of addition (last added runs first),
     * before defaults, enforcement, and validation.
     * @template NewP The type of the input properties after this transformation.
     * @param transform A function that takes the original properties (P) and returns new properties of type NewP.
     * @returns A new blueprint instance with the input transformation and updated input type.
     */
    input<NewP>(
        this: IBlueprint<P, R>,
        transform: (props: P) => NewP
    ): IBlueprint<NewP, R>;

    /**
     * Sets default values for some of the blueprint's properties.
     * These defaults are applied if the properties are not provided at call time.
     * @template K The keys of P for which defaults are being provided.
     * @param defaultsOrProvider An object containing default values for keys K, or a function that returns such an object.
     * @returns A new blueprint instance whose input type reflects that properties in K are now optional.
     */
    defaults<K extends keyof P>(
        this: IBlueprint<P, R>,
        defaultsOrProvider: Partial<Pick<P, K>> | ((props: Omit<P, K>) => Partial<Pick<P, K>>)
    ): IBlueprint<Omit<P, K> & Partial<Pick<P, K>>, R>;


    /**
     * Enforces specific values for a subset of the blueprint's properties.
     * These properties will no longer be required at call time, as their values are fixed.
     * @template K The keys of P for which values are being enforced.
     * @param enforcedValues An object containing the values to enforce for keys K.
     * @returns A new blueprint instance whose input type reflects that properties in K are no longer required.
     */
    enforce<K extends keyof P>(
        this: IBlueprint<P, R>,
        enforcedValues: Pick<P, K> // Values for K must be provided fully
    ): IBlueprint<Omit<P, K>, R>;

    /**
     * Adds a transformation function for the output result.
     * Output mappers are applied in the order they are added, after the core implementation.
     * @template NextR The type of the result after this transformation.
     * @param transform A function that takes the current result (R) and original properties (P)
     *                  and returns a new result of type NextR.
     * @returns A new blueprint instance with the output transformation.
     */
    output<NextR>(
        this: IBlueprint<P, R>,
        transform: (result: R, originalProps: P) => NextR
    ): IBlueprint<P, NextR>;

    /**
     * Adds a side-effect function to be executed before the core implementation.
     * @param effect A function that takes the (post-defaults, post-enforcement, post-input-mapping, post-props-validation) properties.
     * @returns A new blueprint instance with the 'before' hook.
     */
    before(
        this: IBlueprint<P, R>,
        effect: (props: P) => void
    ): IBlueprint<P, R>;

    /**
     * Adds a side-effect function to be executed after the core implementation, output mapping, and result validation.
     * @param effect A function that takes the final (validated) result and the (validated) properties.
     * @returns A new blueprint instance with the 'after' hook.
     */
    after(
        this: IBlueprint<P, R>,
        effect: (result: R, props: P) => void
    ): IBlueprint<P, R>;

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
    pipe<NextR>(
        this: IBlueprint<P, R>,
        nextBlueprintOrFn: IBlueprint<R, NextR> | ((result: R) => NextR)
    ): IBlueprint<P, NextR>;

    /**
     * Applies a Zod schema to validate the input properties.
     * The blueprint's input type `P` will be inferred from the schema.
     * @template S The Zod schema type for props.
     * @param schema The Zod schema for validating input properties.
     * @returns A new blueprint instance with props validation and an updated input type.
     */
    zProps<S extends ZodType<any>>(
        this: IBlueprint<P, R>,
        schema: S
    ): IBlueprint<z.infer<S>, R>;

    /**
     * Applies a Zod schema to validate the result.
     * The blueprint's result type `R` will be inferred from the schema.
     * @template S The Zod schema type for the result.
     * @param schema The Zod schema for validating the result.
     * @returns A new blueprint instance with result validation and an updated result type.
     */
    zResult<S extends ZodType<any>>(
        this: IBlueprint<P, R>,
        schema: S
    ): IBlueprint<P, z.infer<S>>;
}

/**
 * Internal state managed by each blueprint instance.
 */
interface BlueprintState {
    key?: BlueprintKey;
    description?: string;
    implementation?: (props: any) => any;
    inputMappers: Array<(props: any) => any>;
    outputMappers: Array<(result: any, props: any) => any>;
    beforeHooks: Array<(props: any) => void>;
    afterHooks: Array<(result: any, props: any) => void>;
    defaultProviders: Array<(props: any) => Partial<any>>;
    enforcedValues: Partial<any>;
    isAsync: boolean;
    isVoid: boolean;
    validateProps: boolean; // Explicitly false by default
    propsSchema?: ZodType<any>;
    validateResults: boolean; // Explicitly false by default
    resultSchema?: ZodType<any>;
}

/**
 * Creates a new blueprint.
 * Can be called with an initial implementation function or an options object.
 * @template P The type of the input properties. Defaults to `unknown`.
 * @template R The type of the result. Defaults to `void`.
 * @param optionsOrImplementation Optional configuration for the blueprint, or an initial implementation function.
 * @returns A new IBlueprint instance.
 */
export default function blueprint<P, R>(
    initialImplementation: (props: P) => R
): IBlueprint<P, R>;
export default function blueprint<P = unknown, R = void>(
    options?: BlueprintOptions<P, R>
): IBlueprint<P, R>;
export default function blueprint<P = unknown, R = void>(
    optionsOrImplementation?: BlueprintOptions<P, R> | ((props: P) => R)
): IBlueprint<P, R> {

    let parsedOptions: BlueprintOptions<any, any> | undefined;

    if (typeof optionsOrImplementation === 'function') {
        parsedOptions = { initialImplementation: optionsOrImplementation };
    } else {
        parsedOptions = optionsOrImplementation;
    }

    const initialState: BlueprintState = {
        key: parsedOptions?.key,
        description: parsedOptions?.description,
        implementation: parsedOptions?.initialImplementation,
        inputMappers: [],
        outputMappers: [],
        beforeHooks: [],
        afterHooks: [],
        defaultProviders: [],
        enforcedValues: {},
        isAsync: false,
        isVoid: false,
        propsSchema: undefined,
        validateProps: false, // Default to false
        resultSchema: undefined,
        validateResults: false, // Default to false
    };

    function makeCallable(currentState: BlueprintState): IBlueprint<any, any> {
        const callableBlueprint = (props: any): any => {
            let currentProps = typeof props === 'object' && props !== null ? { ...props } : props;
            if (props === undefined && Object.keys(currentState.defaultProviders).length > 0) {
                currentProps = {};
            }

            // 1. Apply defaults
            let resolvedDefaults = {};
            for (const provider of currentState.defaultProviders) {
                const defaults = typeof provider === 'function' ? provider(currentProps) : provider;
                resolvedDefaults = { ...resolvedDefaults, ...defaults };
            }
            currentProps = { ...resolvedDefaults, ...(typeof props === 'object' && props !== null ? props : (props === undefined ? {} : { props })) };
            if (typeof currentProps !== 'object' && Object.keys(currentState.enforcedValues).length === 0 && currentState.inputMappers.length === 0 && !currentState.implementation) {
                // Primitive props scenario
            } else if (typeof currentProps !== 'object' && currentProps !== null && currentProps !== undefined) {
                // Primitive prop with defaults/enforcements
            } else {
                currentProps = { ...resolvedDefaults, ...(currentProps || {}) };
            }

            // 2. Apply enforced values
            currentProps = { ...currentProps, ...currentState.enforcedValues };

            // 3. Input mappers
            let mappedProps = currentProps;
            for (const mapper of currentState.inputMappers) {
                mappedProps = mapper(mappedProps);
            }

            // 3.5 Props validation
            let validatedProps = mappedProps;
            if (currentState.validateProps && currentState.propsSchema) {
                try {
                    validatedProps = currentState.propsSchema.parse(mappedProps);
                } catch (e) {
                    console.error("Blueprint props validation error. State:", currentState, "Props:", mappedProps);
                    // Re-throw ZodError or other errors
                    throw e;
                }
            }

            // 4. Before hooks (operate on validated props)
            currentState.beforeHooks.forEach(hook => hook(validatedProps));

            // 5. Core implementation (with validated props)
            if (!currentState.implementation) {
                const id = currentState.key ? `'${String(currentState.key)}' ` : '';
                throw new Error(`Blueprint ${id}has not been implemented.`);
            }

            let result = currentState.implementation(validatedProps);

            // 6. Async handling for the core result
            if (currentState.isAsync && !(result && typeof result.then === 'function')) {
                result = Promise.resolve(result);
            }

            const processResultAndFinalize = (resolvedResult: any) => {
                let currentResult = resolvedResult;

                // 7. Output mappers (pass validated props)
                for (const mapper of currentState.outputMappers) {
                    currentResult = mapper(currentResult, validatedProps);
                }

                // 7.5 Result validation
                let validatedResult = currentResult;
                if (currentState.validateResults && currentState.resultSchema) {
                    try {
                        validatedResult = currentState.resultSchema.parse(currentResult);
                    } catch (e) {
                        console.error("Blueprint result validation error. State:", currentState, "Result:", currentResult);
                        throw e;
                    }
                }

                // 8. After hooks (pass validated result and validated props)
                currentState.afterHooks.forEach(hook => hook(validatedResult, validatedProps));

                // 9. Void handling
                if (currentState.isVoid) {
                    return undefined;
                }
                return validatedResult;
            };

            if (result && typeof result.then === 'function') { // Is a Promise
                return result.then(processResultAndFinalize);
            } else {
                return processResultAndFinalize(result);
            }
        };

        Object.defineProperty(callableBlueprint, 'key', { value: currentState.key, writable: false, enumerable: true });
        Object.defineProperty(callableBlueprint, 'description', { value: currentState.description, writable: false, enumerable: true });
        Object.defineProperty(callableBlueprint, '__isBlueprint', { value: true, writable: false, enumerable: false });

        callableBlueprint.implement = (newImpl: (props: any) => any) => {
            return makeCallable({ ...currentState, implementation: newImpl });
        };

        callableBlueprint.mod = (modFn: ( callable: (previous: (props: any) => any) => IBlueprint<any, any> ) => IBlueprint<any, any>) => {
            return modFn(callableBlueprint);
        };

        callableBlueprint.more = (modFn: ( callable: (previous: (props: any) => any) => IBlueprint<any, any> ) => IBlueprint<any, any>) => {
            return modFn(callableBlueprint);
        };

        callableBlueprint.input = (transform: (props: any) => any) => {
            return makeCallable({ ...currentState, inputMappers: [transform, ...currentState.inputMappers] });
        };

        callableBlueprint.defaults = (defaultsOrProvider: any) => {
            const provider = typeof defaultsOrProvider === 'function' ? defaultsOrProvider : () => defaultsOrProvider;
            return makeCallable({ ...currentState, defaultProviders: [...currentState.defaultProviders, provider] });
        };

        callableBlueprint.enforce = (enforced: any) => {
            return makeCallable({ ...currentState, enforcedValues: { ...currentState.enforcedValues, ...enforced } });
        };

        callableBlueprint.output = (transform: (result: any, props: any) => any) => {
            return makeCallable({ ...currentState, outputMappers: [...currentState.outputMappers, transform] });
        };

        callableBlueprint.before = (effect: (props: any) => void) => {
            return makeCallable({ ...currentState, beforeHooks: [...currentState.beforeHooks, effect] });
        };

        callableBlueprint.after = (effect: (result: any, props: any) => void) => {
            return makeCallable({ ...currentState, afterHooks: [...currentState.afterHooks, effect] });
        };

        callableBlueprint.toAsync = () => {
            return makeCallable({ ...currentState, isAsync: true });
        };

        callableBlueprint.toVoid = () => {
            return makeCallable({ ...currentState, isVoid: true });
        };

        callableBlueprint.zProps = (schema: ZodType<any>) => {
            return makeCallable({ ...currentState, propsSchema: schema, validateProps: true });
        };

        callableBlueprint.zResult = (schema: ZodType<any>) => {
            return makeCallable({ ...currentState, resultSchema: schema, validateResults: true });
        };

        callableBlueprint.pipe = (nextBlueprintOrFn: IBlueprint<any, any> | ((result: any) => any)) => {
            const newImplementation = (initialProps: any): any => {
                const currentBlueprintResult = callableBlueprint(initialProps);

                const executeNext = (resolvedCurrentResult: any) => {
                    if (typeof nextBlueprintOrFn === 'function' && (nextBlueprintOrFn as IBlueprint<any, any>).__isBlueprint) {
                        return (nextBlueprintOrFn as IBlueprint<any, any>)(resolvedCurrentResult);
                    }
                    return (nextBlueprintOrFn as (result: any) => any)(resolvedCurrentResult);
                };

                if (currentBlueprintResult && typeof currentBlueprintResult.then === 'function') {
                    return currentBlueprintResult.then(executeNext);
                } else {
                    return executeNext(currentBlueprintResult);
                }
            };

            let pipedIsAsync = currentState.isAsync; // Simplistic async propagation
            let pipedIsVoid = currentState.isVoid;  // Simplistic void propagation; determined by final stage.

            return makeCallable({
                key: currentState.key ? `${String(currentState.key)} |> piped` : undefined,
                description: currentState.description ? `${currentState.description}, then piped` : undefined,
                implementation: newImplementation,
                inputMappers: [],
                outputMappers: [],
                beforeHooks: [],
                afterHooks: [],
                defaultProviders: [],
                enforcedValues: {},
                isAsync: pipedIsAsync,
                isVoid: pipedIsVoid,
                propsSchema: undefined, // Piped blueprint starts fresh for validation unless explicitly set
                resultSchema: undefined,
                validateProps: false, // Reset for piped blueprint
                validateResults: false, // Reset for piped blueprint
            });
        };

        return callableBlueprint as IBlueprint<any, any>;
    }

    return makeCallable(initialState) as IBlueprint<P, R>;
}
// Adicione isto ao seu arquivo blueprint/src/index.ts

// Type helper que mapeia strings do array para tipos dos parâmetros
type MapKeysToParams<
  F extends (...args: any[]) => any,
  K extends readonly string[]
> = {
  [Index in keyof K as K[Index] extends string ? K[Index] : never]: 
    Index extends keyof Parameters<F> ? Parameters<F>[Index] : never
}

// Converte o mapped type para um objeto normal
type Simplify<T> = { [K in keyof T]: T[K] } & {}

/**
 * Cria um Blueprint a partir de uma função normal, mapeando parâmetros posicionais para um objeto
 * @template F O tipo da função original
 * @template K Array de strings para as chaves dos parâmetros
 * @param fn A função original que aceita parâmetros posicionais
 * @param keys Array de strings que serão as chaves do objeto de entrada do Blueprint
 * @returns Um Blueprint que aceita um objeto com as chaves especificadas
 */
export function from<
  F extends (...args: any[]) => any,
  const K extends readonly string[]
>(
  fn: F,
  keys: K
): IBlueprint<
  Simplify<MapKeysToParams<F, K>>,
  ReturnType<F>
> {
  type Props = Simplify<MapKeysToParams<F, K>>
  type Result = ReturnType<F>

  return blueprint<Props, Result>().implement((props: Props) => {
    const args = keys.map(key => (props as any)[key]) as Parameters<F>
    return fn(...args)
  })
}

// Adicione como método estático
blueprint.from = from

// Module augmentation
declare module './index' {
  namespace blueprint {
    export function from<
      F extends (...args: any[]) => any,
      const K extends readonly string[]
    >(
      fn: F,
      keys: K
    ): IBlueprint<
      Simplify<MapKeysToParams<F, K>>,
      ReturnType<F>
    >
  }
}