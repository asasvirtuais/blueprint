import { z } from "zod"
import { Addon, Blueprint } from "../index"
import useSWRMutation from "swr/mutation"
import { RequestProps, requestAddon } from "./request"
import { useCallback } from "react"

export interface SWRAddon {
    requestHook<T extends SWRAddon, Props, Result>(
        this: T & Blueprint<Props, Result, (props: Props) => Promise<Result>, T>,
        url: string,
        resultSchema: z.ZodType<Result>,
        key?: string
    ): () => ReturnType<typeof useSWRMutation<Result, any, string, Omit<RequestProps, 'url'>>>
}

export const swrAddon = (): Addon<SWRAddon> => ({
    core: {
        requestHook(url, resultSchema, key) {
            const requestBP = this.addon(requestAddon()).request(url, resultSchema)
            return () => {
                const fetcher = useCallback(
                    async (swrKey: string, { arg }: { arg: Omit<RequestProps, 'url'> }) => {
                        const fullProps: RequestProps = { ...arg, url: swrKey }
                        return await requestBP(fullProps)
                    },
                    []
                )
                const swrKey = key || url
                return useSWRMutation(swrKey, fetcher)
            }
        }
    }
})
