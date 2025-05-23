import { useCallback, useState } from "react"
import { Addon, Blueprint, blueprint } from "../index"
import { ZodType } from "zod"

export interface ReactAddon {
    hook<T extends ReactAddon, Props, Result, Call extends (props: Props) => Result = (props: Props) => Result>(
        this: T & Blueprint<Props, Result, Call, T>,
    ): (props: Props) => Blueprint<Props, Result, Call, T> & {
        loading: boolean
        error: any
        result: Result | undefined
    }
}

export const reactAddon = (): Addon<ReactAddon> => ({
    core: {
        // Todo: hook
    }
})

