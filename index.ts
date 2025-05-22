import { z, ZodType, ZodError, ZodObject, ZodRawShape, ZodFunction, ZodTuple } from 'zod';

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
    description?: string;

    /**
     * Sets the core implementation function for this blueprint.
     * @param implementation The function to execute when the blueprint is called.
     * @returns The blueprint instance for fluent chaining.
     */
    setImplementation(implementation: C): this; // Changed return type to this
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
    name,
    description,
    initialImplementation = (async ({}: P): Promise<R> => { throw new Error('Not Implemented') }) as C
} : {
    propsSchema: ZodType<P>,
    resultSchema: ZodType<R>,
    name?: string,
    description?: string,
    initialImplementation?: C
}): Blueprint<P, R, (props: P) => Promise<R>> { 
    let _implementation: C = initialImplementation;

    // The callable part of the blueprint instance
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

    // Assert the callable to the Blueprint interface
    const blueprintInstance = blueprintInstanceCallable as Blueprint<P, R, C>; 

    // Assign properties and methods to the blueprint instance
    blueprintInstance.propsSchema = propsSchema;
    blueprintInstance.resultSchema = resultSchema;
    blueprintInstance.description = description;
    blueprintInstance.implementationSignatureSchema = z.function(
        z.tuple([propsSchema]),
        z.promise(resultSchema)
    );

    blueprintInstance.setImplementation = function(this: Blueprint<P, R, C>, implementation: C) {
        implementation = implementation;
        return this; // Return this for chaining
    };
    blueprintInstance.getImplementation = (): C => _implementation;
    blueprintInstance.isImplemented = (): boolean => _implementation !== undefined;

    blueprintInstance.mod = function <NewP = P, NewR = R, NewC extends (props: NewP) => Promise<NewR> = (props: NewP) => Promise<NewR>>(
        this: Blueprint<P, R, C>,
        mod: ( 
            originalBP: Blueprint<P, R, C>
        ) => Blueprint<NewP, NewR, NewC>
    ): Blueprint<NewP, NewR, NewC> {
        return mod(this);
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

    return blueprintInstance;
}


// --- Example Usage ---

// Schemas for initial blueprint
const InitialPropsSchema = z.object({
    id: z.string(),
    name: z.string(),
});
type InitialProps = z.infer<typeof InitialPropsSchema>;

const InitialResultSchema = z.object({
    status: z.string(),
    data: z.object({ id: z.string(), name: z.string(), processedName: z.string() }),
});
type InitialResult = z.infer<typeof InitialResultSchema>;

// Create an initial blueprint and set implementation fluently
let bp1 = blueprint<InitialProps, InitialResult>({
    propsSchema: InitialPropsSchema,
    resultSchema: InitialResultSchema,
    description: "Simple Service BP V1"
}).setImplementation(async (props) => { // Chained setImplementation
    if (props.name === "FAIL_ME") {
        throw new Error("Simulated failure in bp1 implementation");
    }
    return {
        status: "original_executed",
        data: {
            id: props.id,
            name: props.name,
            processedName: props.name.toUpperCase(),
        }
    };
});


// --- Example for .mod() to change Props and Result types ---

const ModNewPropsSchema = z.object({
    itemId: z.string(), 
    itemName: z.string(), 
    additionalInfo: z.string().optional(),
});
type ModNewProps = z.infer<typeof ModNewPropsSchema>;

const ModNewResultSchema = z.object({
    outcome: z.enum(["SUCCESS", "FAILURE"]),
    message: z.string(),
    details: ModNewPropsSchema.optional(),
});
type ModNewResult = z.infer<typeof ModNewResultSchema>;

const modFnToChangeTypes = ( 
    originalBP: Blueprint<InitialProps, InitialResult, (props: InitialProps) => Promise<InitialResult>>
): Blueprint<ModNewProps, ModNewResult, (props: ModNewProps) => Promise<ModNewResult>> => { 
    const newDescription = `${originalBP.description} (types transformed by mod fn)`;
    const transformedBlueprint = blueprint<ModNewProps, ModNewResult>({
        propsSchema: ModNewPropsSchema,
        resultSchema: ModNewResultSchema,
        description: newDescription
    });
    return transformedBlueprint;
};

// --- Example for .adapt() method ---
const AdaptedPropsSchema = z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
});
type AdaptedProps = z.infer<typeof AdaptedPropsSchema>;

const AdaptedResultSchema = z.object({
    executionSuccess: z.boolean(),
    summary: z.string(),
    productDetails: z.object({
        originalId: z.string(),
        transformedName: z.string(),
        requestedQuantity: z.number().optional(),
    }).optional(),
});
type AdaptedResult = z.infer<typeof AdaptedResultSchema>;

const productPropsAdapter = (adaptedProps: AdaptedProps): InitialProps | Promise<InitialProps> => {
    if (adaptedProps.quantity <= 0) {
        throw new Error(`[productPropsAdapter] Invalid quantity: ${adaptedProps.quantity}. Must be positive.`);
    }
    return Promise.resolve({ 
        id: adaptedProps.productId, 
        name: adaptedProps.productName 
    });
};

const productResultAdapter = (initialResult: InitialResult, adaptedProps?: AdaptedProps): AdaptedResult => {
    const success = initialResult.status === "original_executed";
    return {
        executionSuccess: success,
        summary: `Product ${adaptedProps?.productId} (name: ${adaptedProps?.productName}) processing: ${success ? 'OK' : 'Failed'}. Original status: ${initialResult.status}.`,
        productDetails: {
            originalId: initialResult.data.id,
            transformedName: initialResult.data.processedName,
            requestedQuantity: adaptedProps?.quantity,
        }
    };
};

// --- Example for LoggerAddon ---
interface LoggerAddon {
    readonly logPrefix: string; 
    log: (message: string) => void;
    setLogPrefix: (prefix: string) => void;
}

const createLoggerAddon = (initialPrefix: string): LoggerAddon => {
    let currentPrefix = initialPrefix; 
    return {
        get logPrefix() { 
            return currentPrefix;
        },
        log: function(message: string) {
            const bpDescription = (this as any).description || 'Blueprint';
            console.log(`[${bpDescription} Log - ${currentPrefix}]: ${message}`);
        },
        setLogPrefix: function(newPrefix: string) {
            currentPrefix = newPrefix;
        }
    };
};

// --- Example for ReactAddon ---
interface ReactAddon {
    /** Placeholder for React hook integration. Returns `this` for chaining. */
    hook(): this;
    /** Placeholder for React context integration. Returns `this` for chaining. */
    context(): this;
}

const createReactAddon = (): ReactAddon => {
    return {
        hook: function() {
            console.log(`[ReactAddon ${(this as any).description || ''}] hook() called.`);
            return this;
        },
        context: function() {
            console.log(`[ReactAddon ${(this as any).description || ''}] context() called.`);
            return this;
        }
    };
};


async function runSimplifiedExamples() {
    console.log("--- Running Simplified Blueprint Examples ---");
    console.log("Created bp1 (and set implementation):", bp1.description, "Is implemented:", bp1.isImplemented());

    // 1. Basic call to bp1
    console.log("\n--- Example 1: Basic bp1 call (SUCCESS) ---");
    try {
        const result1 = await bp1({ id: "item001", name: "First Item" });
        console.log("✅ bp1 Direct Call Result:", result1);
    } catch (e: any) {
        console.error("❌ bp1 Direct Call Error:", e.message);
    }

    console.log("\n--- Example 1b: Basic bp1 call (FAILURE in impl) ---");
    try {
        await bp1({ id: "item002", name: "FAIL_ME" });
    } catch (e: any) {
        console.error("❌ bp1 Direct Call Error (expected):", e.message);
    }

    // 2. Using .mod()
    console.log("\n--- Example 2: Using .mod() ---");
    try {
        const bp2_transformed = bp1.mod(modFnToChangeTypes) 
            .setImplementation(async (props) => { // Chaining setImplementation after mod
                if (props.itemName.length < 3) {
                    return { outcome: "FAILURE" as const, message: "Item name too short.", details: props };
                }
                return { outcome: "SUCCESS" as const, message: `Item ${props.itemId} (${props.itemName}) processed. Info: ${props.additionalInfo || 'N/A'}`, details: props };
            });
        console.log("Blueprint returned by .mod() and implemented:", bp2_transformed.description, "Is implemented:", bp2_transformed.isImplemented());
        
        console.log("Calling bp2_transformed (SUCCESS case):");
        const modResultSuccess = await bp2_transformed({ itemId: "mod-789", itemName: "Transformed Item", additionalInfo: "Via .mod() with function" });
        console.log("✅ bp2_transformed SUCCESS Result:", modResultSuccess);

        console.log("Calling bp2_transformed (FAILURE case):");
        const modResultFailure = await bp2_transformed({ itemId: "mod-000", itemName: "No" });
        console.log("✅ bp2_transformed FAILURE Result:", modResultFailure);

    } catch (e: any) {
        console.error("❌ Error during .mod() example:", e.message, e.stack);
    }

    // 3. Using .adapt() method
    console.log("\n--- Example 3: Using .adapt() method ---");
    try {
        // .adapt() returns a new blueprint, its setImplementation is called by the adapt method itself.
        const bp_adapted = bp1.adapt(
            AdaptedPropsSchema,
            AdaptedResultSchema,
            productPropsAdapter,
            productResultAdapter,
            "Adapted Product Service BP (via .adapt method)"
        );
        console.log("Created adapted blueprint:", bp_adapted.description, "Is implemented:", bp_adapted.isImplemented());
        
        console.log("Calling bp_adapted (SUCCESS case):");
        const adaptedResultSuccess = await bp_adapted({ productId: "prod-XYZ", productName: "Awesome Gadget", quantity: 10 });
        console.log("✅ bp_adapted SUCCESS Result:", adaptedResultSuccess);

        console.log("Calling bp_adapted (FAILURE case - props adapter error):");
        try {
            await bp_adapted({ productId: "prod-FAIL-QUANTITY", productName: "ZeroCount Gadget", quantity: 0 });
        } catch (e: any) {
            console.error("❌ bp_adapted Error (expected from props adapter):", e.message);
        }

        console.log("Calling bp_adapted (FAILURE case - original bp1 impl error):");
         try {
            await bp_adapted({ productId: "prod-FAIL-IMPL", productName: "FAIL_ME", quantity: 5 });
        } catch (e: any) {
            console.error("❌ bp_adapted Error (expected from original bp1 impl):", e.message);
        }
    } catch (e: any) {
        console.error("❌ Error during .adapt() method example:", e.message, e.stack);
    }

    let bpWithAddon: Blueprint<InitialProps, InitialResult>
    // 4. Using LoggerAddon with .addon() method
    console.log("\n--- Example 4: Using LoggerAddon with .addon() method ---");
    try {
        let bpWithAddon = blueprint<InitialProps, InitialResult>({
            propsSchema: InitialPropsSchema,
            resultSchema: InitialResultSchema,
            description: "Logger Test BP"
        })
            .setImplementation(async (props) => ({status: "logged", data: {...props, processedName: props.name.toUpperCase()}}))
            .addon(createLoggerAddon("TestBP")); // Chaining addon after setImplementation
        
        console.log("bpWithLogger description:", bpWithAddon.description); 
        console.log("Logger prefix:", bpWithAddon.logPrefix); 

        bpWithAddon.log("This is a test log from the LoggerAddon."); 
        bpWithAddon.setLogPrefix("ServiceTest");
        bpWithAddon.log("Log with new prefix.");

        const resultWithLogger = await bpWithAddon({ id: "log-item-001", name: "Logging Item" });
        console.log("✅ bpWithLogger Call Result:", resultWithLogger);
        
        if (bpWithAddon.isImplemented()) {
             bpWithAddon.log("bpWithLogger is implemented.");
        }
    } catch (e: any) {
        console.error("❌ Error during LoggerAddon example:", e.message, e.stack);
    }

    // 5. Using ReactAddon with .addon() method
    console.log("\n--- Example 5: Using ReactAddon with .addon() method ---");
    try {
        bpWithAddon = blueprint<InitialProps, InitialResult>({
            propsSchema: InitialPropsSchema,
            resultSchema: InitialResultSchema,
            description: "React Test BP"
        }) .setImplementation(async (props) => ({status: "react-ok", data: {...props, processedName: props.name.toUpperCase()}}))
        .addon(createReactAddon()) // Chaining addon
        .hook() // Chaining addon method
        .context(); // Chaining addon method

        console.log("bpWithReact description:", bpWithAddon.description);

        console.log("Calling bpWithReact (which is bpForReact, now with React addon methods):");
        const resultWithReact = await bpWithAddon({ id: "react-item-001", name: "React Item" });
        console.log("✅ bpWithReact Call Result:", resultWithReact);

        if (typeof (bpWithAddon as any).log === 'function') {
            console.log("bpWithReact has a log method - this means LoggerAddon was also applied.");
        } else {
            console.log("bpWithReact does NOT have a log method (as expected for this isolated example).");
        }

    } catch (e: any) {
        console.error("❌ Error during ReactAddon example:", e.message, e.stack);
    }

}

// To run examples:
runSimplifiedExamples();
