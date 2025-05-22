export type PropFunction<Props, Result> = (props: Props) => Result

export interface Core<Props = unknown, Result = unknown, Self = unknown> {
    (props: Props): Result

    addon<C>(addon: Addon<C>): C & Self & Core<Props, Result, Self & C>

    someMethod(this: Self & Core<Props, Result, Self>, headerValues: HeadersInit, parameter: number): this

    void() : this
}

export type Addon<C> = {
    core?: C
}

export const notImplemented = <Props>(_: Props): never => {
    throw new Error('Not Implemented')
}

export function core<Props, Result, Self = unknown>(handle: PropFunction<Props, Result> = notImplemented) {

    const _addons: Addon<unknown>[] = []

    const implementation = ((props: Props) => {
        try {
            return handle(props)
        } catch (error) {
            console.error(error, handle, props)
            throw error
        }
    }) as Core<Props, Result, Self>

    implementation.void = function() {
        return this
    }

    // @ts-expect-error this has to be ignored
    implementation.addon = function(addon) {
        return { ...this, _addons: [_addons, addon], ...addon.core }
    }

    // @ts-expect-error
    implementation.someMethod = function(this: Core<Props,Result, Self>, number: number) {
        return this
    }

    return implementation
}



interface SomeAddon {
    some<T extends SomeAddon, Props, Result>(this: T & Core<Props, Result, T>): this
}

interface FoneAddon {
    fone<T extends FoneAddon, Props, Result>(this: T & Core<Props, Result, T>): this
}

export const soonAddon: Addon<SomeAddon> = {
    core: {
        some() {
            return this
        },
    }
}
export const lateAddon: Addon<FoneAddon> = {
    core: {
        fone() {
            return this
        }
    }
}

// The following chain can only be typed with this architecture. I got it from the wretch library.
const myFunction = core<{a: 1, b: 2}, {c: 3}>().void().addon(soonAddon).some().addon(lateAddon).fone().void().some().fone()
.someMethod()
// No errors, typescript ok, IDE ok
myFunction({a: 1, b: 2}).c === 3
// */
