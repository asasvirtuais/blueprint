import { useCallback, useState } from "react"
import { Addon, Blueprint, blueprint } from "../index"
import { asyncAddon } from "./async"

export interface ReactAddon {
    hook<T extends ReactAddon, Props, Result>(this: T & Blueprint<T, Props, {
        loading: boolean
        args: Props
        result: Result
        error: Error | null
        trigger: (overwrite?: Props) => Promise<Result>
    }>): this
}

export const reactAddon = (): Addon<ReactAddon> => ({
    core: {
        hook<
            T extends ReactAddon,
            Props,
            Result
        >(
            this: T & Blueprint<T, Props, Result>
        ) {
            return this.addon(asyncAddon).mod(
                blueprint => {
                    return function useBlueprint(props: Props) {
                        const [loading, setLoading] = useState(true)
                        const [args, setArgs] = useState(props)
                        const [result, setResult] = useState<Result>(null as unknown as Result)
                        const [error, setError] = useState<Error | null>(null)

                        const trigger = useCallback(async (overwrite?: Props) => {
                            setLoading(true)
                            setArgs(overwrite || props)
                            try {
                                const res = await blueprint(overwrite || props)
                                setResult(res)
                                return res
                            } catch (e) {
                                setError(e as Error)
                            } finally {
                                setLoading(false)
                            }
                        }, [props])

                        return { loading, args, result, error, trigger }
                    }
                }
            )
        }
    }
})

