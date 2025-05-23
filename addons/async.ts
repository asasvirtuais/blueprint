import { Addon, Blueprint } from '../index'

/** Overwrites blueprint methods to async functions */
export interface AsyncAddon {
    async<T extends AsyncAddon, Props, Result>(this: T & Blueprint<Props, Promise<Result>, (props: Props) => Promise<Result>, T>): any
    enforce<E>(enforce: E | ((props: any) => E)): any
    defaults<D>(defaults: D | ((props: any) => D)): any
    returning<R>(adapter: (result: any, props?: any) => R): any
}

export const asyncAddon: Addon<AsyncAddon> = {
    core: {
        async: function () {
            return this.mod((blueprint) => {
                return async props => await blueprint(props)
            })
        },
        enforce: function <E>(enforce: E | ((props: any) => E)) {
            // @ts-expect-error: Blueprint methods available via prototype chain
            return this.mod((blueprint: any) => {
                return async (props: any) => {
                    const enforced = typeof enforce === 'function' ? (enforce as (props: any) => E)(props) : enforce
                    const mergedProps = { ...props, ...enforced }
                    return await blueprint(mergedProps)
                }
            })
        },
        defaults: function <D>(defaults: D | ((props: any) => D)) {
            // @ts-expect-error: Blueprint methods available via prototype chain
            return this.mod((blueprint: any) => {
                return async (props: any) => {
                    const defaulted = typeof defaults === 'function' ? (defaults as (props: any) => D)(props) : defaults
                    const mergedProps = {
                        ...defaulted,
                        ...props
                    }
                    return await blueprint(mergedProps)
                }
            })
        },
        returning: function <R>(adapter: (result: any, props?: any) => R) {
            // @ts-expect-error: Blueprint methods available via prototype chain
            return this.mod((blueprint: any) => {
                return async (props: any) => {
                    const result = await blueprint(props)
                    return adapter(result, props)
                }
            })
        },
    },
    
}