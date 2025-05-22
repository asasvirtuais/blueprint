import { z, ZodType, ZodError, ZodObject, ZodRawShape, ZodFunction, ZodTuple, ZodTypeAny } from 'zod'

export interface Blueprint<P, R, C extends (props: P) => Promise<R> = (props: P) => Promise<R>, Self = unknown> {
    (props: P): Promise<R>

    propsSchema: ZodType<P>
    resultSchema: ZodType<R>
    implementationSignatureSchema: ZodFunction<ZodTuple<[ZodType<P>]>, ZodType<Promise<R>>>
    name?: string
    description?: string

    setImplementation(this: Self & Blueprint<P, R, C, Self>, implementation: C): this
    getImplementation: () => C
    isImplemented: () => boolean

    mod<NewP = P, NewR = R>(
        this: Self & Blueprint<P, R, C, Self>,
        mod: (originalBP: Blueprint<P, R, C>) => Blueprint<NewP, NewR, (props: NewP) => Promise<NewR>>
    ): Blueprint<NewP, NewR, (props: NewP) => Promise<NewR>> & Omit<this, keyof Blueprint<P, R>>

    addon<B>(addon: Addon<B>): B & Self & Blueprint<P, R, C, Self & B>

    enforce<E extends Partial<P>>(
        this: Self & Blueprint<P, R, C, Self>,
        enforcedValues: E
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => Promise<R>> & Omit<this, keyof Blueprint<P, R>>

    defaults<D extends Partial<P>>(
        this: Self & Blueprint<P, R, C, Self>,
        defaultValuesProvider: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R> & Omit<this, keyof Blueprint<P, R>>

    returning<NewR>(
        this: Self & Blueprint<P, R, C, Self>,
        adapter: (result: R, props?: P) => NewR | Promise<NewR>,
        newResultSchema: ZodType<NewR>
    ): Blueprint<P, NewR, (props: P) => Promise<NewR>> & Omit<this, keyof Blueprint<P, R>>
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
    initialImplementation = (async (_props: P): Promise<R> => { throw new Error('Not Implemented') }) as C
}: {
    propsSchema: ZodType<P>,
    resultSchema: ZodType<R>,
    name?: string,
    description?: string,
    initialImplementation?: C
}): Blueprint<P, R, (props: P) => Promise<R>> {
    let _implementation: C = initialImplementation

    const blueprintInstanceCallable = async (propsValue: P): Promise<R> => {
        let validatedProps: P
        try {
            validatedProps = propsSchema.parse(propsValue)
        } catch (error) {
            if (error instanceof ZodError) {
                throw new Error(`Input properties validation failed for blueprint${description ? ` '${description}'` : ''}: ${error.message} \nDetails: ${JSON.stringify(error.errors)}`)
            }
            throw error
        }

        if (!_implementation) {
            throw new Error(`Implementation not set for blueprint${description ? ` '${description}'` : ''}.`)
        }
        const promiseResult = _implementation(validatedProps)
        const rawResultValue = await promiseResult

        let validatedResultValue: R
        try {
            validatedResultValue = resultSchema.parse(rawResultValue)
        } catch (error) {
            if (error instanceof ZodError) {
                throw new Error(`Result validation failed for blueprint${description ? ` '${description}'` : ''}: ${error.message} \nDetails: ${JSON.stringify(error.errors)}`)
            }
            throw error
        }
        return validatedResultValue
    }

    const blueprintInstance = blueprintInstanceCallable as Blueprint<P, R, C>

    blueprintInstance.propsSchema = propsSchema
    blueprintInstance.resultSchema = resultSchema
    blueprintInstance.name = name
    blueprintInstance.description = description
    blueprintInstance.implementationSignatureSchema = z.function(
        z.tuple([propsSchema as ZodTypeAny]),
        z.promise(resultSchema)
    )

    blueprintInstance.setImplementation = function (this: Blueprint<P, R, C>, newImplementation: C) {
        _implementation = newImplementation
        return this
    }
    blueprintInstance.getImplementation = (): C => _implementation
    blueprintInstance.isImplemented = (): boolean => typeof _implementation === 'function' && _implementation.toString() !== (async (_props: P): Promise<R> => { throw new Error('Not Implemented') }).toString()

    blueprintInstance.mod = function <NewP = P, NewR = R, NewC extends (props: NewP) => Promise<NewR> = (props: NewP) => Promise<NewR>>(
        this: Blueprint<P, R, C>,
        modFn: (
            originalBP: Blueprint<P, R, C>
        ) => Blueprint<NewP, NewR, NewC>
    ): Blueprint<NewP, NewR, NewC> {
        return modFn(this)
    }

    const _addons: Addon<unknown>[] = []
    //@ts-expect-error C could be instantiated with a type that not of Blueprint
    blueprintInstance.addon = function(addon) {
        return { ...this, _addons: [_addons, addon], ...addon.core }
    }

    blueprintInstance.enforce = function <E extends Partial<P>>(
        this: Blueprint<P, R, C>,
        enforcedValues: E
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => Promise<R>> {
        const originalBP = this

        if (!(originalBP.propsSchema instanceof ZodObject)) {
            throw new Error("Cannot use .enforce() on a blueprint with a non-object propsSchema. Current schema type: " + originalBP.propsSchema.constructor.name)
        }
        
        const keysToOmitForSchema: Record<string, true> = {}
        Object.keys(enforcedValues).forEach(k => keysToOmitForSchema[k] = true)

        const originalZodObject = originalBP.propsSchema as ZodObject<any, any, any, P, P>
        const newPropsSchemaUntyped = originalZodObject.omit(keysToOmitForSchema)
        //@ts-ignore typescript can't handle it
        const newPropsSchema = newPropsSchemaUntyped as ZodType<Omit<P, keyof E>>

        type NewPEnforce = Omit<P, keyof E>

        return originalBP.mod(currentBP => { 
            return blueprint<NewPEnforce, R>({
                propsSchema: newPropsSchema,
                resultSchema: currentBP.resultSchema, 
                description: `${currentBP.description || 'Unnamed'} (enforced)`, 
            }).setImplementation(async (newProps: NewPEnforce) => {
                const combinedProps = { ...newProps, ...enforcedValues } as P
                return currentBP(combinedProps)
            }) as Blueprint<NewPEnforce, R, (props: NewPEnforce) => Promise<R>>
        }) as Blueprint<NewPEnforce, R, (props: NewPEnforce) => Promise<R>>
    }

    blueprintInstance.defaults = function <D extends Partial<P>>(
        this: Blueprint<P, R, C>,
        defaultValuesProvider: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R> {

        type NewPDefaults = Omit<P, keyof D> & Partial<D>

        const originalBP = this
        if (!(originalBP.propsSchema instanceof ZodObject)) {
            throw new Error("Cannot use .defaults() on a blueprint with a non-object propsSchema. Current schema type: " + originalBP.propsSchema.constructor.name)
        }

        const originalZodObject = originalBP.propsSchema as ZodObject<ZodRawShape, any, any, P, P>
        const originalShape = originalZodObject.shape

        let keysForDefaults: (keyof D)[] = []
        if (typeof defaultValuesProvider !== 'function') {
            keysForDefaults = Object.keys(defaultValuesProvider) as (keyof D)[]
        } else {
             console.warn("[defaults] When using a function provider for defaultValuesProvider, static determination of keys for schema optional marking is not possible. The resulting schema might not correctly reflect optional fields unless D explicitly lists keys.")
        }
        
        const newShape = { ...originalShape }
        keysForDefaults.forEach(key => {
            const keyStr = key as string
            if (newShape[keyStr]) {
                if (typeof (newShape[keyStr] as ZodTypeAny).optional === 'function') {
                     newShape[keyStr] = (newShape[keyStr] as ZodTypeAny).optional()
                } else {
                    console.warn(`[defaults] Schema for key '${keyStr}' does not have an optional method.`)
                }
            }
        })
        
        //@ts-expect-error beyond typescript scope
        const newPropsSchema = z.object(newShape) as ZodType<NewPDefaults>

        return originalBP.mod(currentBP => {
            const newBP = blueprint<NewPDefaults, R>({
                propsSchema: newPropsSchema,
                resultSchema: currentBP.resultSchema,
                description: `${currentBP.description || 'Unnamed'} (with defaults)`,
            })

            newBP.setImplementation(async (props: NewPDefaults) => { 
                const defaultValues = typeof defaultValuesProvider === 'function'
                    ? defaultValuesProvider(props as any)
                    : defaultValuesProvider
                const combinedProps = { ...defaultValues, ...props } as P
                return currentBP(combinedProps)
            })
            return newBP as Blueprint<NewPDefaults, R, (props: NewPDefaults) => Promise<R>>
        }) as Blueprint<NewPDefaults, R, (props: NewPDefaults) => Promise<R>>
    }

    blueprintInstance.returning = function <NewR>(
        this: Blueprint<P, R, C>,
        adapter: (result: R, props?: P) => NewR | Promise<NewR>,
        newResultSchema: ZodType<NewR>
    ): Blueprint<P, NewR, (props: P) => Promise<NewR>> {
        const originalBP = this

        return originalBP.mod(currentBP => {
            return blueprint<P, NewR>({
                propsSchema: currentBP.propsSchema,
                resultSchema: newResultSchema,
                description: `${currentBP.description || 'Unnamed'} (returning transformed)`,
            }).setImplementation(async (props: P) => {
                const originalResult = await currentBP(props)
                const transformedResult = await adapter(originalResult, props)
                return transformedResult
            }) as Blueprint<P, NewR, (props: P) => Promise<NewR>>
        }) as Blueprint<P, NewR, (props: P) => Promise<NewR>>
    }

    return blueprintInstance
}

export type Addon<C> = {
    core?: C
}