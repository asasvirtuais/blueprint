import { z, ZodType, ZodError, ZodObject, ZodRawShape, ZodFunction, ZodTuple, ZodTypeAny } from 'zod'

export interface Blueprint<P = {}, R = {}, C extends (props: P) => R = (props: P) => R, Self = unknown> {
    (props: P): R

    key?: string
    description?: string

    implementation: C
    addons: Addon[]

    implement(this: Self & Blueprint<P, R, C, Self>, implementation: C): this

    mod<NewP = P, NewR = R>(
        this: Self & Blueprint<P, R, C, Self>,
        mod: (blueprint: Self & Blueprint<P, R, C, Self>) => (props: NewP) => NewR
    ): Blueprint<NewP, NewR, (props: NewP) => NewR> & Omit<this, keyof Blueprint<P, R>>

    addon<A extends Addon>(addon: A): A['core'] & Self & Blueprint<P, R, C, Self & A['core']>

    enforce<E extends Partial<P>>(
        this: Self & Blueprint<P, R, C, Self>,
        enforcedValues: E
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => R> & Omit<this, keyof Blueprint<P, R>>

    defaults<D extends Partial<P>>(
        this: Self & Blueprint<P, R, C, Self>,
        defaultValuesProvider: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R> & Omit<this, keyof Blueprint<P, R>>

    returning<NewR>(
        this: Self & Blueprint<P, R, C, Self>,
        adapter: (result: R, props?: P) => NewR,
        newResultSchema: ZodType<NewR>
    ): Blueprint<P, NewR, (props: P) => NewR> & Omit<this, keyof Blueprint<P, R>>
}

/**
 * Creates a simplified "late implementation" function blueprint with mod, adapt, and addon methods.
 */
export function blueprint<
    P,
    R,
    C extends (props: P) => R = (props: P) => R,
    T extends Addon = Addon
>({
    key,
    description,
    addons = [],
    init = (async (_props: P) => { throw new Error('Not Implemented') }) as C
}: {
    key?: string,
    description?: string,
    init?: C,
    addons?: Addon[]
}): Blueprint<P, R, (props: P) => R, T> {

    let implementation: C = init

    type This = Blueprint<P, R, C, T>
    const _blueprint = implementation as unknown as This

    _blueprint.key = key
    _blueprint.description = description

    _blueprint.implement = function (this: This, newImplementation: C) {
        implementation = newImplementation
        return _blueprint
    }

    // @ts-expect-error could be instantiate with different subtype error
    _blueprint.mod = function <NewP = P, NewR = R, NewC extends (props: NewP) => NewR = (props: NewP) => NewR>(
        this: This,
        mod: (
            originalBP: This
        ) => (props: NewP) => NewR
    ): Blueprint<NewP, NewR, NewC, T> {
        // @ts-expect-error could be instantiate with different subtype error
        return blueprint({
            addons: _blueprint.addons,
            key: _blueprint.key,
            description: _blueprint.description,
            init: (props: NewP) => mod(_blueprint)(props),
        })
    }

    _blueprint.addons = addons

    // @ts-expect-error could be instantiate with different subtype error
    _blueprint.addon = function(addon) {
        _blueprint.addons.push(addon)
        return _blueprint
    }

    _blueprint.enforce = function <E extends Partial<P>>(
        this: This,
        enforce: E | ((props: P) => E)
    ): Blueprint<Omit<P, keyof E>, R, (props: Omit<P, keyof E>) => R> {
        // @ts-expect-error could be instantiate with different subtype error
        return _blueprint.mod(blueprint => {
            return (props) => blueprint({ ...props, ...(
                // @ts-expect-error could be instantiate with different subtype error
                typeof enforce === 'function' ? enforce(props) : enforce
            ) } as P)
        })
    }

    _blueprint.defaults = function <D extends Partial<P>>(
        this: This,
        defaults: D | ((props: P) => D)
    ): Blueprint<Omit<P, keyof D> & Partial<D>, R> {

        type NewP = Omit<P, keyof D> & Partial<D>

        // @ts-expect-error could be instantiate with different subtype error
        return _blueprint.mod(blueprint => {
            return (props) => blueprint({
                // @ts-expect-error could be instantiate with different subtype error
            ...(typeof defaults === 'function' ? defaults(props) : defaults),
            ...props } as P)
        }) as Blueprint<NewP, R, (props: NewP) => R>
    }

    _blueprint.returning = function <NewR>(
        this: Blueprint<P, R, C>,
        returning: (result: R, props?: P) => NewR | NewR,
    ): Blueprint<P, NewR, (props: P) => NewR> {
        // @ts-expect-error could be instantiate with different subtype error
        return _blueprint.mod(blueprint => {
            // @ts-expect-error could be instantiate with different subtype error
            return blueprint((props: P) => {
                const transformedResult = returning(blueprint(props), props)
                return transformedResult
            }) as Blueprint<P, NewR, (props: P) => NewR>
        }) as Blueprint<P, NewR, (props: P) => NewR>
    }

    return _blueprint
}

export type Addon<B = unknown> = {
    core: B
}