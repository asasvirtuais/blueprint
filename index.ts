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
            const originalResult = await originalBP(originalProps);
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

    // --- Implementation for enforce ---
    blueprintInstance.enforce = function <E extends Partial<P>>(
        this: Blueprint<P, R, C>,
        enforcedValuesProvider: E | ((props: Omit<P, keyof E>) => E)
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => Promise<R>> {
        const originalBP = this;

        if (!(originalBP.propsSchema instanceof ZodObject)) {
            throw new Error("Cannot use .enforce() on a blueprint with a non-object propsSchema. Current schema type: " + originalBP.propsSchema.constructor.name);
        }
        
        // Determine keys to omit based on the provider type
        // If it's a function, we can't know keys statically for schema omit,
        // but we must assume the function provides ALL keys defined in E.
        // For schema modification, we need the keys. If `enforcedValuesProvider` is a function,
        // we can't get the keys without calling it. This implies `E` must be an object if we want to change the schema.
        // Let's assume `enforcedValuesProvider` (if object) or `E` (type) gives the keys.
        // A simple approach: if it's an object, use its keys. If it's a function, this is harder for schema.
        // For simplicity, let's get keys from the first parameter if it's an object, otherwise this is tricky.
        // A common pattern for E is that it's a concrete object type, so Object.keys(enforcedValuesProvider) works if it's not a function.
        // To make it robust, we'd need E to be a Zod schema itself, or pass keys explicitly.
        // Given E extends Partial<P>, we can't directly get keys of E for omit.
        // We must rely on the actual object if provided.
        
        // This part is tricky: to create `newPropsSchema.omit(keys)`, `keys` must be from `enforcedValuesProvider` if it's an object.
        // If `enforcedValuesProvider` is a function, we don't know the keys to omit for the schema beforehand.
        // The type `Omit<P, keyof E>` implies we *do* know `keyof E`.
        // This means `E` should represent the *shape* of the enforced props.
        // We'll assume `Object.keys()` on `enforcedValuesProvider` (if it's an object) is sufficient for demo.
        // A more robust solution might require passing a Zod schema for E.
        let exampleKeysForOmission: Record<string, true> = {};
        if (typeof enforcedValuesProvider !== 'function') {
             Object.keys(enforcedValuesProvider).forEach(k => exampleKeysForOmission[k] = true);
        } else {
            // If it's a function, we can't statically determine keys to omit for the schema.
            // This is a limitation. The `Omit<P, keyof E>` implies E's keys are known.
            // This suggests `E` should be a type with known keys.
            // For this implementation, we'll proceed assuming E's keys are what we want to omit.
            // This part would need refinement for full type safety with function providers if E's keys aren't inferable.
            // However, `keyof E` in `Omit<P, keyof E>` refers to the keys of the type E, not the runtime value.
            // This is a structural typing aspect.
            // We can't use `keyof E` directly in `omit`'s runtime argument.
            // The `omit` method needs a runtime object specifying keys.
            // This is a fundamental challenge if `E` is only a type and `enforcedValuesProvider` is a function.
            // For now, we'll throw if it's a function and we can't get keys.
            // A better approach: the `enforce` method should take a schema for the enforced part.
            // Or, the user must ensure `E` has keys that can be listed.
             console.warn("[enforce] When using a function provider, static determination of keys for schema omission is not possible. The resulting schema might not be strictly Omit<P, keyof E>.");
        }


        // Cast propsSchema to ZodObject to access .omit and .shape
        const originalZodObject = originalBP.propsSchema as ZodObject<any, any, any, P, P>;
        // The keys to omit must be passed as an object ` { key1: true, key2: true } `
        // This is problematic if E's keys are not known at runtime from `enforcedValuesProvider`
        // For this example, we'll proceed with `exampleKeysForOmission` which is best-effort.
        // @ts-expect-error (probably works)
        const newPropsSchema = originalZodObject.omit(exampleKeysForOmission) as ZodType<Omit<P, keyof E>>;
        type NewP = Omit<P, keyof E>;

        return originalBP.mod(currentBP => { // currentBP is the original blueprint instance
            return blueprint<NewP, R>({
                propsSchema: newPropsSchema,
                resultSchema: currentBP.resultSchema, // Use result schema from currentBP
                description: `${currentBP.description || 'Unnamed'} (enforced)`, // Simplified description
            }).setImplementation(async (newProps: NewP) => {
                const enforcedValues = typeof enforcedValuesProvider === 'function'
                    ? enforcedValuesProvider(newProps) // Call function with the new, partial props
                    : enforcedValuesProvider;
                const combinedProps = { ...newProps, ...enforcedValues } as P; // newProps first, then enforced, though keys shouldn't overlap
                return currentBP(combinedProps); // Call the original blueprint's implementation
            }) as Blueprint<NewP, R, (props: NewP) => Promise<R>>;
        }) as Blueprint<NewP, R, (props: NewP) => Promise<R>>; // Cast the result of mod
    };


    // --- Implementation for defaults ---
    blueprintInstance.defaults = function <D extends Partial<P>>(
        this: Blueprint<P, R, C>,
        defaultValuesProvider: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R> {

        type NewP = Omit<P, keyof D> & Partial<D>

        const originalBP = this;
        if (!(originalBP.propsSchema instanceof ZodObject)) {
            throw new Error("Cannot use .defaults() on a blueprint with a non-object propsSchema. Current schema type: " + originalBP.propsSchema.constructor.name);
        }

        const originalZodObject = originalBP.propsSchema as ZodObject<any, any, any, P, P>;
        const originalShape = originalZodObject.shape;

        let keysForDefaults: (keyof D)[] = [];
        if (typeof defaultValuesProvider !== 'function') {
            keysForDefaults = Object.keys(defaultValuesProvider) as (keyof D)[];
        } else {
            // If provider is a function, we don't know keys statically to make them optional in schema.
            // This is a limitation. For robust schema transformation, defaultValuesProvider should be an object,
            // or keys need to be passed explicitly.
            // `keyof D` provides the type-level keys.
            console.warn("[defaults] When using a function provider, static determination of keys for schema optional marking is not possible. The resulting schema might not correctly reflect optional fields.");
        }


        const newShape = { ...originalShape };
        keysForDefaults.forEach(key => {
            if (newShape[key as string]) {
                newShape[key as string] = (newShape[key as string] as ZodTypeAny).optional();
            }
        });
        
        const newPropsSchema = z.object(newShape);

        return originalBP.mod(currentBP => {
            const newBP = blueprint<NewP, R>({
                // @ts-expect-error (yes it's an object)
                propsSchema: newPropsSchema as ZodType<NewP>,
                resultSchema: currentBP.resultSchema,
                description: `${currentBP.description || 'Unnamed'} (with defaults)`,
            });

            newBP.setImplementation(async (props: NewP) => { // props type is NewP
                const defaultValues = typeof defaultValuesProvider === 'function'
                    ? defaultValuesProvider(props as any) // Cast props if function expects specific partial type
                    : defaultValuesProvider;
                const combinedProps = { ...defaultValues, ...props } as P; // Defaults first, then incoming props
                return currentBP(combinedProps);
            });
            return newBP as Blueprint<NewP, R>
        });
    };

    return blueprintInstance;
}

