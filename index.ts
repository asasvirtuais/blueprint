import { z, ZodType } from 'zod'

export interface Blueprint<Self = unknown, P = {}, R = {}> {
    (props: P): R

    key?: string
    description?: string

    implementation: (props: P) => R
    addons: Addon[]

    implement(this: Self & Blueprint<Self, P, R>, implementation: (props: P) => R): this

    mod<NewP = P, NewR = R>(
        this: Self & Blueprint<Self, P, R>,
        mod: (blueprint: Self & Blueprint<Self, P, R>) => (props: NewP) => NewR
    ): Blueprint<Self, NewP, NewR> & Omit<this, keyof Blueprint<Self, P, R>>

    addon<A extends Addon>(addon: A): A['core'] & Self & Blueprint<Self & A['core'], P, R>

    enforce<E extends Partial<P>>(
        this: Self & Blueprint<Self, P, R>,
        enforcedValues: E
    ): Self & Blueprint<Blueprint<Self, P, R>, Omit<P, keyof E>, R>

    defaults<D extends Partial<P>>(
        this: Self & Blueprint<Self, P, R>,
        defaultValuesProvider: D | ((props: P) => D)
    ): Self & Blueprint<Self, Omit<P, keyof D> & Partial<D>>

    returning<NewR>(
        this: Self & Blueprint<Self, P, R>,
        adapter: (result: R, props?: P) => NewR,
        newResultSchema: ZodType<NewR>
    ): Self & Blueprint<Self, P, NewR>

    async(this: Self & Blueprint<Self, P, R>): Self & Blueprint<Self, P, Promise<R>>

    void(this: Self & Blueprint<Self, P, R>): Self & Blueprint<Self, P, void>
}

/**
 * Creates a simplified "late implementation" function blueprint with mod, adapt, and addon methods.
 */
export function blueprint<
    P = {},
    R = {},
>({
    key,
    description,
    addons = [],
    init = ((_props: P) => { throw new Error('Not Implemented') }) as (props: P) => R
}: {
    key?: string,
    description?: string,
    init?: (props: P) => R,
    addons?: Addon[]
}): Blueprint<{}, P, R> {

    type T = Blueprint<{}, P, R>

    let implementation: (props: P) => R = init

    type This = T
    const _blueprint = implementation as This

    _blueprint.key = key
    _blueprint.description = description

    _blueprint.implement = function (this: This, newImplementation: (props: P) => R ) {
        implementation = newImplementation
        return _blueprint
    }

    _blueprint.mod = function <NewP = P, NewR = R>(
        this: This,
        mod: (
            originalBP: This
        ) => (props: NewP) => NewR
    ) {
        return blueprint({
            addons: _blueprint.addons,
            key: _blueprint.key,
            description: _blueprint.description,
            init: (props: NewP) => mod(_blueprint)(props),
        })
    }

    _blueprint.addons = addons

    _blueprint.addon = function(addon) {
        _blueprint.addons.push(addon)
        return _blueprint
    }

    _blueprint.enforce = function <E extends Partial<P>>(
        this: This,
        enforce: E | ((props: P) => E)
    ): Blueprint<This, Omit<P, keyof E>, R> {
    // @ts-expect-error unrelated subtype issue
        return _blueprint.mod(blueprint => {
            return (props: P) => blueprint({
                ...props,
                ...(typeof enforce === 'function' ? enforce(props) : enforce)
            } as P)
        })
    }

    _blueprint.defaults = function <D extends Partial<P>>(
        this: This,
        defaults: D | ((props: P) => D)
    ): Blueprint<This, Omit<P, keyof D> & Partial<D>, R> {

        type NewP = Omit<P, keyof D> & Partial<D>

        return _blueprint.mod(blueprint => {
            return (props) => blueprint({
                // @ts-expect-error could be instantiate with different subtype error
            ...(typeof defaults === 'function' ? defaults(props) : defaults),
            ...props } as P)
        }) as Blueprint<This, NewP, R>
    }

    _blueprint.returning = function <NewR>(
        returning: ((result: R, props?: P) => NewR) | NewR,
    ): Blueprint<This, P, NewR> {
        return _blueprint.mod(blueprint => {
            // @ts-expect-error could be instantiate with different subtype error
            return blueprint((props: P) => {
                return typeof returning === 'function' ? (returning as (result: R, props?: P) => NewR)(blueprint(props), props) : returning
            }) as Blueprint<This, P, NewR>
        }) as Blueprint<This, P, NewR>
    }

    _blueprint.void = function () {
        return _blueprint.mod(blueprint => {
            return (props: P) => {
                blueprint(props)
            }
        }) as Blueprint<This, P, void>
    }

    return _blueprint
}

export type Addon<B = unknown> = {
    core: B
}