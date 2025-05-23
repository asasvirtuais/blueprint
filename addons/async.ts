import { Addon, blueprint, Blueprint } from '../index'

/** Overwrites blueprint methods to async functions */
export interface AsyncAddon {
    async <T extends AsyncAddon, Props, Result>(this: T & Blueprint<T, Props, Promise<Result>>): T & Blueprint<T, Props, Promise<Result>>
    enforce<T extends AsyncAddon, Props, Result, E>(this: T & Blueprint<T, Props, Promise<Result>>, enforce: E | ((props: Props) => E)): T & Blueprint<T, Props, Promise<Result>>
    defaults<T extends AsyncAddon, Props, Result, D>(this: T & Blueprint<T, Props, Promise<Result>>, defaults: D | ((props: Props) => D)): T & Blueprint<T, Props, Promise<Result>>
    returning<T extends AsyncAddon, Props, Result, R>(this: T & Blueprint<T, Props, Promise<Result>>, adapter: (result: Result, props?: Props) => R): T & Blueprint<T, Props, Promise<Result>>
}

export const asyncAddon: Addon<AsyncAddon> = {
    core: {
        enforce: function<
            T extends AsyncAddon,
            Props,
            Result,
            E
        >(
            this: T & Blueprint<T, Props, Promise<Result>>,
            enforce: E | ((props: Props) => E)
        ) {
            return this.mod((blueprint) => {
                return async (props) => {
                    const enforced = typeof enforce === 'function' ? (enforce)(props) : enforce
                    return await blueprint({ ...props, ...enforced })
                }
            })
        },
        async() {
            return this.mod((blueprint) => {
                return async (props) => await blueprint(props)
            })
        },
        defaults: function <
            T extends AsyncAddon,
            Props,
            Result,
            D
        >(
            this: T & Blueprint<T, Props, Promise<Result>>,
            defaults: D | ((props: Props) => D)
        ) {
            return this.mod((blueprint) => {
                return async (props) => {
                    const defaulted = typeof defaults === 'function' ? (defaults)(props) : defaults
                    return await blueprint({ ...defaulted, ...props })
                }
            })
        },
        returning: function <
            T extends AsyncAddon,
            Props,
            Result,
            R
        >(
            this: T & Blueprint<T, Props, Promise<Result>>,
            returning: (result: R, props?: Props) => R,
        ) {
            return this.mod((blueprint) => {
                return async (props: any) => {
                    const result = await blueprint(props)
                    return returning(result, props)
                }
            })
        },
    },
    
}
