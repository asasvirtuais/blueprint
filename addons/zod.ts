import { z, ZodType } from 'zod'
import { Addon, Blueprint } from '../src/index'

export interface ZodAddon {
    zod<T extends ZodAddon, P, R>(this: T & Blueprint<T, P, R>, schemas: { props?: ZodType<P>, result?: ZodType<R> }): T
    zProps<T extends ZodAddon, P, R>(this: T & Blueprint<T, P, R>, schema: ZodType<P>): this
    zResult<T extends ZodAddon, P, R>(this: T & Blueprint<T, P, R>, schema: ZodType<R>): this
    schemas?: {
        props?: ZodType
        result?: ZodType
    }
}

export const zodAddon: Addon<ZodAddon> = {
    core: {
        schemas: {
            props: undefined,
            result: undefined,
        },
        zod(schemas) {
            this.schemas = {
                ...(this.schemas || {}),
                ...schemas,
            }
            return this
        },
        zProps(schema) {
            this.schemas = {
                ...(this.schemas || {}),
                props: schema,
            }
            return this
        },
        zResult(schema) {
            this.schemas = {
                ...(this.schemas || {}),
                result: schema,
            }
            return this
        }
    }
}
