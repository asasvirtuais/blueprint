import { useCallback, useState } from "react"
import { Addon, Blueprint } from "../src/index"

export interface ReactAddon {
    // hook<T extends ReactAddon, Props, Result>(this: T & Blueprint<T, Props, Result>): this
}

export function hook<Props, Result>(blueprint: Blueprint<ReactAddon, Props, Result>) {
    return blueprint.mod(blueprint => {
        return function useBlueprint(props) {
            const [loading, setLoading] = useState(true)
            const [args, setArgs] = useState(props)
            const [result, setResult] = useState<Awaited<Result>>()
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
    })
}

export const reactAddon: Addon<ReactAddon> = {
    core: {
        // todo
        // hook() {
        //     return this
        // }
    }
}

