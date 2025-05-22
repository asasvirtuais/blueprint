import { z, ZodType, ZodError, ZodObject, ZodRawShape, ZodFunction, ZodTuple, ZodTypeAny } from 'zod';

/**
 * Interface for a simplified Blueprint.
 * @template P The type of the properties object (single parameter).
 * @template R The type of the result (the resolved value of the Promise).
 * @template C The type of the core implementation function, (props: P) => Promise<R>.
 */
export interface Blueprint<P, R, C extends (props: P) => Promise<R> = (props: P) => Promise<R>> {
    /**
     * Calls the blueprint's implementation with the given properties.
     * Validates props before calling and validates the result after.
     * @param props The properties object for the function call.
     * @returns A Promise that resolves with the validated result.
     * @throws Error if props/result validation fails or if no implementation is set.
     */
    (props: P): Promise<R>;

    propsSchema: ZodType<P>;
    resultSchema: ZodType<R>;
    implementationSignatureSchema: ZodFunction<ZodTuple<[ZodType<P>]>, ZodType<Promise<R>>>;
    name?: string;
    description?: string;

    /**
     * Sets the core implementation function for this blueprint.
     * @param implementation The function to execute when the blueprint is called.
     * @returns The blueprint instance for fluent chaining.
     */
    setImplementation(implementation: C): this;
    getImplementation: () => C;
    isImplemented: () => boolean;

    /**
     * Transforms the current blueprint using a modifier function.
     * The modifier function receives the current blueprint instance
     * and is expected to return a new, potentially modified, blueprint instance.
     * @template NewP Props type of the blueprint returned by the modifier function.
     * @template NewR Result type of the blueprint returned by the modifier function.
     * @param mod A function that takes the current blueprint
     * and returns a new Blueprint.
     * @returns The new Blueprint instance created by the modifier function.
     */
    mod<NewP = P, NewR = R>(
        mod: (
            originalBP: Blueprint<P, R, C>
        ) => Blueprint<NewP, NewR, (props: NewP) => Promise<NewR>>
    ): Blueprint<NewP, NewR, (props: NewP) => Promise<NewR>>;

    /**
     * Creates a new blueprint by adapting the properties (props) and result of this blueprint.
     * The new blueprint reuses the implementation of this blueprint, with adapter functions
     * bridging the differences in input and output types.
     * @template NewP The properties type of the new (adapted) blueprint.
     * @template NewR The result type of the new (adapted) blueprint.
     * @param newPropsSchema The Zod schema for the new blueprint's properties.
     * @param newResultSchema The Zod schema for the new blueprint's result.
     * @param propsAdapter A function to transform NewP to P (this blueprint's props type). Can be async.
     * @param resultAdapter A function to transform R (this blueprint's result type) to NewR. Can be async and receive NewP for context.
     * @param newDescription An optional description for the adapted blueprint.
     * @returns A new Blueprint with adapted props and result types, wrapping this blueprint's logic.
     */
    adapt<NewP, NewR>(
        newPropsSchema: ZodType<NewP>,
        newResultSchema: ZodType<NewR>,
        propsAdapter: (newProps: NewP) => P | Promise<P>,
        resultAdapter: (oldResult: R, newProps?: NewP) => NewR | Promise<NewR>,
        newDescription?: string
    ): Blueprint<NewP, NewR, (props: NewP) => Promise<NewR>>;

    /**
     * Merges the properties and methods of an addon object into this blueprint instance.
     * The blueprint instance is mutated.
     * @template AI The type of the addon object.
     * @param addonImplementation The addon object to merge.
     * @returns The blueprint instance, now augmented with the addon's members.
     */
    addon<AI extends object>(
        addonImplementation: AI
    ): this & AI;

    /**
     * Creates a new blueprint where certain properties are fixed ("enforced") to specific values.
     * The new blueprint will not expect these enforced properties as input.
     * @template E An object type representing the properties to enforce. Values in `enforcedValuesProvider` must match these types.
     * @param enforcedValuesProvider Either an object containing the enforced values, or a function that takes the (remaining) new props and returns the enforced values.
     * @returns A new Blueprint that takes `Omit<P, keyof E>` as props.
     */
    enforce<E extends Partial<P>>(
        enforcedValuesProvider: E | ((props: Omit<P, keyof E>) => E)
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => Promise<R>>;

    /**
     * Creates a new blueprint where certain properties have default values.
     * If these properties are not provided when calling the new blueprint, their default values will be used.
     * The props with defaults become optional in the new blueprint's input.
     * @template D An object type representing the properties that will have defaults.
     * @param defaultValuesProvider Either an object containing the default values, or a function that takes the (potentially partial) new props and returns the default values.
     * @returns A new Blueprint whose props (with defaults) are now optional.
     */
    defaults<D extends Partial<P>>(
        defaultValuesProvider: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R>;

    /**
     * Creates a new blueprint that keeps the same properties (props) but transforms the result.
     * The new blueprint reuses the implementation of the original blueprint, applying an adapter
     * to its result.
     * @template NewR The new result type of the blueprint.
     * @param adapter A function to transform the original result (R) to NewR. Can be async and receive the original props (P) for context.
     * @param newResultSchema The Zod schema for the new blueprint's result (NewR).
     * @returns A new Blueprint with the original props type (P) and the new result type (NewR).
     */
    returning<NewR>(
        adapter: (result: R, props?: P) => NewR | Promise<NewR>,
        newResultSchema: ZodType<NewR>
    ): Blueprint<P, NewR, (props: P) => Promise<NewR>>;
}

/**
 * Creates a simplified "late implementation" function blueprint with mod, adapt, and addon methods.
 */
export function blueprint<
    P,
    R,
    C extends (props: P) => Promise<R> = (props: P) => Promise<R>
>({
    propsSchema,
    resultSchema,
    name, // name is currently unused but kept from original
    description,
    initialImplementation = (async (_props: P): Promise<R> => { throw new Error('Not Implemented') }) as C
}: {
    propsSchema: ZodType<P>,
    resultSchema: ZodType<R>,
    name?: string,
    description?: string,
    initialImplementation?: C
}): Blueprint<P, R, (props: P) => Promise<R>> {
    let _implementation: C = initialImplementation;

    const blueprintInstanceCallable = async (propsValue: P): Promise<R> => {
        let validatedProps: P;
        try {
            validatedProps = propsSchema.parse(propsValue);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new Error(`Input properties validation failed for blueprint${description ? ` '${description}'` : ''}: ${error.message} \nDetails: ${JSON.stringify(error.errors)}`);
            }
            throw error;
        }

        if (!_implementation) { // Ensure implementation is set
            throw new Error(`Implementation not set for blueprint${description ? ` '${description}'` : ''}.`);
        }
        const promiseResult = _implementation(validatedProps);
        const rawResultValue = await promiseResult;

        let validatedResultValue: R;
        try {
            validatedResultValue = resultSchema.parse(rawResultValue);
        } catch (error) {
            if (error instanceof ZodError) {
                throw new Error(`Result validation failed for blueprint${description ? ` '${description}'` : ''}: ${error.message} \nDetails: ${JSON.stringify(error.errors)}`);
            }
            throw error;
        }
        return validatedResultValue;
    };

    const blueprintInstance = blueprintInstanceCallable as Blueprint<P, R, C>;

    blueprintInstance.propsSchema = propsSchema;
    blueprintInstance.resultSchema = resultSchema;
    blueprintInstance.name = name;
    blueprintInstance.description = description;
    blueprintInstance.implementationSignatureSchema = z.function(
        z.tuple([propsSchema as ZodTypeAny]), // Use ZodTypeAny for tuple items
        z.promise(resultSchema)
    );

    blueprintInstance.setImplementation = function (this: Blueprint<P, R, C>, newImplementation: C) {
        _implementation = newImplementation; // Correctly assign to the internal variable
        return this;
    };
    blueprintInstance.getImplementation = (): C => _implementation;
    blueprintInstance.isImplemented = (): boolean => typeof _implementation === 'function' && _implementation.toString() !== (async (_props: P): Promise<R> => { throw new Error('Not Implemented') }).toString();


    blueprintInstance.mod = function <NewP = P, NewR = R, NewC extends (props: NewP) => Promise<NewR> = (props: NewP) => Promise<NewR>>(
        this: Blueprint<P, R, C>,
        modFn: (
            originalBP: Blueprint<P, R, C>
        ) => Blueprint<NewP, NewR, NewC>
    ): Blueprint<NewP, NewR, NewC> {
        return modFn(this);
    };

    blueprintInstance.adapt = function <NewP, NewR>(
        this: Blueprint<P, R, C>,
        newPropsSchema: ZodType<NewP>,
        newResultSchema: ZodType<NewR>,
        propsAdapter: (newProps: NewP) => P | Promise<P>,
        resultAdapter: (oldResult: R, newProps?: NewP) => NewR | Promise<NewR>,
        newDescription?: string
    ): Blueprint<NewP, NewR, (props: NewP) => Promise<NewR>> {
        const originalBP = this;
        const actualNewDescription = newDescription ?? `Adapted (${originalBP.description || 'Unnamed Blueprint'})`;

        const adaptedBlueprint = blueprint<NewP, NewR>({
            propsSchema: newPropsSchema,
            resultSchema: newResultSchema,
            description: actualNewDescription,
        });

        adaptedBlueprint.setImplementation(async (adaptedPropsValue: NewP): Promise<NewR> => {
            const originalProps = await Promise.resolve(propsAdapter(adaptedPropsValue));
            const originalResult = await originalBP(originalProps); // originalBP is callable
            const newAdaptedResult = await Promise.resolve(resultAdapter(originalResult, adaptedPropsValue));
            return newAdaptedResult;
        });
        return adaptedBlueprint;
    };

    blueprintInstance.addon = function <AI extends object>(
        this: Blueprint<P, R, C>,
        addonImplementation: AI
    ): Blueprint<P, R, C> & AI {
        Object.assign(this, addonImplementation);
        return this as Blueprint<P, R, C> & AI;
    };

    blueprintInstance.enforce = function <E extends Partial<P>>(
        this: Blueprint<P, R, C>,
        enforcedValuesProvider: E | ((props: Omit<P, keyof E>) => E)
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => Promise<R>> {
        const originalBP = this;

        if (!(originalBP.propsSchema instanceof ZodObject)) {
            throw new Error("Cannot use .enforce() on a blueprint with a non-object propsSchema. Current schema type: " + originalBP.propsSchema.constructor.name);
        }
        
        let keysToOmitForSchema: Record<string, true> = {};
        if (typeof enforcedValuesProvider !== 'function') {
             Object.keys(enforcedValuesProvider).forEach(k => keysToOmitForSchema[k] = true);
        } else {
            console.warn("[enforce] When using a function provider for enforcedValuesProvider, the new props schema will not omit keys. Consider providing an object or ensuring E's keys are manually omitted if schema strictness is critical.");
            // If E is a generic type parameter without a concrete value at runtime (like when enforcedValuesProvider is a function),
            // we cannot reliably get its keys for `omit`. The type `Omit<P, keyof E>` is a type-level operation.
            // Zod's `omit` method requires a runtime object specifying which keys to omit.
            // In this case, newPropsSchema will be the same as originalPropsSchema, which might be acceptable
            // as the runtime logic will still merge the enforced values.
            // Alternatively, one might require `E` to be constrained e.g. to `z.ZodObject` to extract keys, or pass keys explicitly.
        }

        const originalZodObject = originalBP.propsSchema as ZodObject<any, any, any, P, P>;
        // @ts-ignore ZodObject.omit expects a specific type for keys, this is a simplified approach
        const newPropsSchemaUntyped = Object.keys(keysToOmitForSchema).length > 0 ? originalZodObject.omit(keysToOmitForSchema) : originalZodObject;
        const newPropsSchema = newPropsSchemaUntyped  as ZodType<Omit<P, keyof E>>;

        type NewPEnforce = Omit<P, keyof E>;

        return originalBP.mod(currentBP => { 
            return blueprint<NewPEnforce, R>({
                propsSchema: newPropsSchema,
                resultSchema: currentBP.resultSchema, 
                description: `${currentBP.description || 'Unnamed'} (enforced)`, 
            }).setImplementation(async (newProps: NewPEnforce) => {
                const enforcedValues = typeof enforcedValuesProvider === 'function'
                    ? enforcedValuesProvider(newProps) 
                    : enforcedValuesProvider;
                const combinedProps = { ...newProps, ...enforcedValues } as P; 
                return currentBP(combinedProps); 
            }) as Blueprint<NewPEnforce, R, (props: NewPEnforce) => Promise<R>>;
        }) as Blueprint<NewPEnforce, R, (props: NewPEnforce) => Promise<R>>; 
    };


    blueprintInstance.defaults = function <D extends Partial<P>>(
        this: Blueprint<P, R, C>,
        defaultValuesProvider: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R> {

        type NewPDefaults = Omit<P, keyof D> & Partial<D>;

        const originalBP = this;
        if (!(originalBP.propsSchema instanceof ZodObject)) {
            throw new Error("Cannot use .defaults() on a blueprint with a non-object propsSchema. Current schema type: " + originalBP.propsSchema.constructor.name);
        }

        const originalZodObject = originalBP.propsSchema as ZodObject<ZodRawShape, any, any, P, P>; // Use ZodRawShape
        const originalShape = originalZodObject.shape;

        let keysForDefaults: (keyof D)[] = [];
        if (typeof defaultValuesProvider !== 'function') {
            keysForDefaults = Object.keys(defaultValuesProvider) as (keyof D)[];
        } else {
             console.warn("[defaults] When using a function provider for defaultValuesProvider, static determination of keys for schema optional marking is not possible. The resulting schema might not correctly reflect optional fields unless D explicitly lists keys.");
            // We need to infer keys from D to make them optional in the schema.
            // This can be tricky if D is a broad `Partial<P>`.
            // For a more robust schema transformation, defaultValuesProvider being an object is preferred,
            // or you might need to pass the keys explicitly if D is too generic.
        }
        
        const newShape = { ...originalShape };
        keysForDefaults.forEach(key => {
            const keyStr = key as string;
            if (newShape[keyStr]) {
                // Ensure the schema exists and can be made optional
                if (typeof (newShape[keyStr] as ZodTypeAny).optional === 'function') {
                     newShape[keyStr] = (newShape[keyStr] as ZodTypeAny).optional();
                } else {
                    console.warn(`[defaults] Schema for key '${keyStr}' does not have an optional method.`);
                }
            }
        });
        
        // Create new Zod object with potentially optional fields
        // @ts-expect-error beyond typescript scope
        const newPropsSchema = z.object(newShape) as ZodType<NewPDefaults>;


        return originalBP.mod(currentBP => {
            const newBP = blueprint<NewPDefaults, R>({
                propsSchema: newPropsSchema,
                resultSchema: currentBP.resultSchema,
                description: `${currentBP.description || 'Unnamed'} (with defaults)`,
            });

            newBP.setImplementation(async (props: NewPDefaults) => { 
                const defaultValues = typeof defaultValuesProvider === 'function'
                    // The props received here are NewPDefaults, which might be missing some keys from P.
                    // The defaultValuesProvider function might expect a P. This is a slight mismatch.
                    // Common practice is that defaultValuesProvider might get partially filled props.
                    ? defaultValuesProvider(props as any) // Safest to cast, or ensure provider handles Partial<P>
                    : defaultValuesProvider;
                const combinedProps = { ...defaultValues, ...props } as P; 
                return currentBP(combinedProps);
            });
            return newBP as Blueprint<NewPDefaults, R, (props: NewPDefaults) => Promise<R>>;
        }) as Blueprint<NewPDefaults, R, (props: NewPDefaults) => Promise<R>>;
    };

    // --- Implementation for returning ---
    blueprintInstance.returning = function <NewR>(
        this: Blueprint<P, R, C>,
        adapter: (result: R, props?: P) => NewR | Promise<NewR>,
        newResultSchema: ZodType<NewR>
    ): Blueprint<P, NewR, (props: P) => Promise<NewR>> {
        const originalBP = this;
        // We can reuse the `adapt` method.
        // NewP is the same as P.
        // NewR is the NewR from the returning method.
        // propsAdapter is an identity function for P.
        // resultAdapter is the adapter provided to `returning`.
        return originalBP.adapt<P, NewR>(
            originalBP.propsSchema, // Props schema remains the same
            newResultSchema,        // New result schema
            (currentProps: P) => currentProps, // Props adapter: identity
            adapter,                // Result adapter from the method argument
            `${originalBP.description || 'Unnamed Blueprint'} (result adapted)` // New description
        );
    };

    return blueprintInstance;
}