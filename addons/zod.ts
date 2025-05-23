import { z, ZodType } from 'zod'
import { Addon, Blueprint, blueprint } from '../index'

export interface ZodAddon {
    zod<T extends ZodAddon, P, R>(
        this: T & Blueprint<P, R, (props: P) => R, T>,
        schemas: { props?: ZodType<P>, result?: ZodType<R> }
    ): Blueprint<P, R, (props: P) => R, ZodAddon>
    schemas?: {
        props?: ZodType
        result?: ZodType
    }
    // Set props schema
    zProps<T extends ZodAddon, P, R>(this: T & Blueprint<P, R, (props: P) => R, T>, schema: ZodType<P>): Blueprint<P, R, (props: P) => R, ZodAddon>
    // Set result schema
    zResult<T extends ZodAddon, P, R>(this: T & Blueprint<P, R, (props: P) => R, T>, schema: ZodType<R>): Blueprint<P, R, (props: P) => R, ZodAddon>
}

export const zodAddon: Addon<ZodAddon> = {
    core: {
        schemas: {
            props: undefined,
            result: undefined,
        },
        zod<T extends ZodAddon, P, R>(this: T & Blueprint<P, R, (props: P) => R, T>, schemas: { props?: ZodType<P>, result?: ZodType<R> }) {
            this.schemas = {
                ...(this.schemas || {}),
                ...schemas,
            }
            return this.mod((blueprint) => {
                return ((props: P) => {
                    if (schemas.props)
                        props = schemas.props.parse(props)
                    const result = blueprint(props)
                    if (schemas.result)
                        return schemas.result.parse(result)
                    return result
                })
            }) as Blueprint<P, R, (props: P) => R, ZodAddon>
        },
        zProps<T extends ZodAddon, P, R>(this: T & Blueprint<P, R, (props: P) => R, T>, schema: ZodType<P>) {
            this.schemas = {
                ...(this.schemas || {}),
                props: schema,
            }
            return this
        },
        zResult<T extends ZodAddon, P, R>(this: T & Blueprint<P, R, (props: P) => R, T>, schema: ZodType<R>) {
            this.schemas = {
                ...(this.schemas || {}),
                result: schema,
            }
            return this
        }
    }
}
