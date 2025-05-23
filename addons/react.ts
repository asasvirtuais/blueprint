import { useCallback, useState } from "react"
import { Addon, Blueprint, blueprint } from "../index"
import { ZodType } from "zod"

type WithUseResult<Props, Result> = {
    loading: boolean
    error: any
    result: Result | undefined
    trigger: (props: Props) => Promise<Result>
}

export interface ReactAddon {
    hook<T extends ReactAddon, Props, Result, Call extends (props: Props) => Promise<Result> = (props: Props) => Promise<Result>>(
        this: T & Blueprint<Props, Result, Call, T>,
    ): () => Blueprint<Props, Result, Call, T> & {
        loading: boolean
        error: any
        result: Result | undefined
    }
    hookWithUse<T extends ReactAddon, Props, Result, Call extends (props: Props) => Promise<Result> = (props: Props) => Promise<Result>>(
        this: T & Blueprint<Props, Result, Call, T>,
        resultSchema: ZodType<any>
    ): Blueprint<Props, WithUseResult<Props, Result>, (props: Props) => Promise<WithUseResult<Props, Result>>, T>
}

export const reactAddon = (): Addon<ReactAddon> => ({
    core: {
        hook<T extends ReactAddon, Props, Result, Call extends (props: Props) => Promise<Result> = (props: Props) => Promise<Result>>() {
            const blueprintInstance = this as T & Blueprint<Props, Result, Call, T>

            return () => {
                const [loading, setLoading] = useState(false)
                const [error, setError] = useState<any>()
                const [result, setResult] = useState<Result>()
                const triggerBlueprint = useCallback(
                    // @ts-expect-error extends but could be assignable error
                    blueprintInstance.mod(originalBP => // originalBP is essentially blueprintInstance here
                        blueprint<any, any>({ // Define the new blueprint that will be our 'trigger'
                            propsSchema: originalBP.propsSchema, // It accepts the same props as the original
                            resultSchema: originalBP.resultSchema,
                            description: `${originalBP.description || 'Blueprint'} (hook-wrapped)`
                        }).setImplementation(async (props: any) => { // Implementation for the new 'trigger' blueprint
                            setLoading(true)
                            setError(undefined) // Clear previous error
                            try {
                                return await originalBP(props) // Call the original blueprint logic
                            } catch (e) {
                                setError(e)
                                throw e // Re-throw so the caller of the blueprint also sees the error
                            } finally {
                                setLoading(false)
                            }
                        })
                    ) as Blueprint<Props, Result, Call, T> & { name: string }, // Cast to the correct type,
                    // Dependencies for creating this triggerBlueprint:
                    // blueprintInstance is from 'this', effectively stable for the hook's lifecycle.
                    // setLoading, setError, setResult are stable state setters.
                    [blueprintInstance, setLoading, setError, setResult]
                )


                return Object.assign(triggerBlueprint, {
                    loading,
                    error,
                    result,
                }) as T & Blueprint<Props, Result, Call, T> & {
                    loading: boolean
                    error: any
                    result: Result | undefined
                }
            }
        },
        hookWithUse<T extends ReactAddon, Props, Result, Call extends (props: Props) => Promise<Result> = (props: Props) => Promise<Result>>(resultSchema: ZodType<any>) {
            const blueprintInstance = this as T & Blueprint<Props, Result, Call, T>

            return blueprintInstance.mod(originalBP => {
                // @ts-expect-error 'T' could be instantiated with an arbitrary type which could be unrelated
                return blueprint<Props, WithUseResult<Props, Result>, (props: Props) => Promise<WithUseResult<Props, Result>>, T>({
                    propsSchema: originalBP.propsSchema,
                    resultSchema: resultSchema,
                    description: `${originalBP.description || 'Blueprint'} (withUse-wrapped)`
                }).setImplementation(async (props: Props) => {
                    const [loading, setLoading] = useState(false)
                    const [error, setError] = useState<any>()
                    const [result, setResult] = useState<Result>()
                    const trigger = useCallback(() => {
                        setLoading(true)
                        setError(undefined) // Clear previous error
                        return originalBP(props).then(res => {
                            setResult(res)
                            return res
                        }).catch(e => {
                            setError(e)
                            throw e // Re-throw so the caller of the blueprint also sees the error
                        }).finally(() => {
                            setLoading(false)
                        })
                    }, [])
                    return {
                        loading,
                        error,
                        result,
                        trigger
                    } as WithUseResult<Props, Result>
                })
            })
        }
    }
})
