import { Addon, Blueprint } from '../index'

/** Overwrites blueprint methods to async functions */
export interface AsyncAddon {
    async<T extends AsyncAddon, Props, Result>(this: T & Blueprint<Props, Promise<Result>, (props: Props) => Promise<Result>, T>): this
}

export const asyncAddon: Addon<AsyncAddon> = {
    core: {
        async: function () {
            return this.mod((blueprint) => {
                return async props => await blueprint(props)
            })
        },
    },
    
}