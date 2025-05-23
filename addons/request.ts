import { z } from "zod"
import { Addon, Blueprint, blueprint } from "../index"

export interface RequestProps {
    url: string
    method?: string
    body?: any
    query?: Record<string, string>
}

const requestPropsSchema = z.object({
    url: z.string(),
    method: z.string().optional(),
    body: z.any().optional(),
    query: z.record(z.string()).optional()
})

export interface RequestAddon {
    request<T extends RequestAddon, Props, Result>(
        this: T & Blueprint<Props, Result, (props: Props) => Promise<Result>, T>,
        url: string,
        newResultSchema: z.ZodType<Result>
    ): Blueprint<RequestProps, Result, (props: RequestProps) => Promise<Result>, T>
}

export const requestAddon = (): Addon<RequestAddon> => ({
    core: {
        request(url: string, newResultSchema: z.ZodType<any>) {
            return this.mod((currentBP) => {
                // Create a new blueprint with RequestProps schema
                const newBP = blueprint<RequestProps, any>({
                    propsSchema: requestPropsSchema,
                    resultSchema: newResultSchema,
                    description: `${currentBP.description || 'Unnamed'} (request)`,
                })
                
                return newBP.implement(async (props: RequestProps) => {
                    // Build URL with query params if provided
                    let fetchUrl = props.url || url
                    if (props.query) {
                        const params = new URLSearchParams(props.query)
                        fetchUrl = `${fetchUrl}?${params.toString()}`
                    }

                    const response = await fetch(fetchUrl, {
                        method: props.method || 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: props.body ? JSON.stringify(props.body) : undefined
                    })
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`)
                    }
                    
                    const result = await response.json()
                    return result
                })
            })
        }
    }
})