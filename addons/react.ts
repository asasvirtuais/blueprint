import { z } from "zod"
import { Addon, Blueprint } from "../index"
import useSWRMutation from "swr/mutation"
import { RequestProps, requestAddon } from "./request"
import { useCallback } from "react"

export interface ReactAddon {
    requestHook<T extends ReactAddon, Props, Result>(
        this: T & Blueprint<Props, Result, (props: Props) => Promise<Result>, T>,
        url: string,
        resultSchema: z.ZodType<Result>,
        key?: string
    ): () => ReturnType<typeof useSWRMutation<Result, any, string, Omit<RequestProps, 'url'>>>
}

export const reactAddon = (): Addon<ReactAddon> => ({
    core: {
        requestHook(url, resultSchema, key) {
            // First apply the request addon and call request method
            const requestBP = this.addon(requestAddon()).request(url, resultSchema)
            
            // Return a function that when called (as a hook) returns useSWRMutation
            return () => {
                // Create a memoized fetcher that maps SWR args to request props
                const fetcher = useCallback(
                    async (swrKey: string, { arg }: { arg: Omit<RequestProps, 'url'> }) => {
                        // The SWR key is the URL, combine with other props
                        const fullProps: RequestProps = { ...arg, url: swrKey }
                        return await requestBP(fullProps)
                    },
                    []
                )
                
                // Use provided key or the url as the SWR key
                const swrKey = key || url
                return useSWRMutation(swrKey, fetcher)
            }
        }
    }
})