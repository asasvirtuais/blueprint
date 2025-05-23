import { NextRequest, NextResponse } from 'next/server'
import { Blueprint, blueprint, Addon } from '../index'
import { z } from 'zod'

export interface NextAddon {
    route<T extends NextAddon, Props, Result>(this: T & Blueprint<Props, Promise<Result>, (props: Props) => Promise<Result>, T>): this
}

export const nextAddon: Addon<NextAddon> = {
    core: {
        route: function() {
            const originalBP = this
            
            // Create new Blueprint that takes NextRequest as props
            const routeBP = originalBP.mod(currentBP => {
                return blueprint<NextRequest, Promise<NextResponse>>({
                    propsSchema: z.custom<NextRequest>((val) => val instanceof NextRequest),
                    resultSchema: z.custom<Promise<NextResponse>>((val) => val instanceof Promise),
                    description: `${currentBP.description || 'Unnamed'} (Next.js route)`
                }).implement(async (request: NextRequest): Promise<NextResponse> => {
                    try {
                        // Extract all the messy props from NextRequest
                        const url = request.nextUrl
                        const queryParams = Object.fromEntries(url.searchParams.entries())
                        
                        // Extract route params (would need actual route matching logic)
                        const routeParams: Record<string, string> = {}
                        
                        // Get body if available and method supports it
                        let body: any = {}
                        if (request.method !== 'GET' && request.method !== 'HEAD') {
                            try {
                                body = await request.json()
                            } catch {
                                // No JSON body or invalid JSON
                            }
                        }
                        
                        // Merge all into messyProps
                        const messyProps = {
                            ...routeParams,
                            ...queryParams,
                            ...body
                        }
                        
                        // Call original blueprint with messyProps
                        const result = await currentBP(messyProps)
                        
                        return NextResponse.json(result, { status: 200 })
                    } catch (error) {
                        const message = error instanceof Error ? error.message : 'Internal Server Error'
                        return NextResponse.json(
                            { error: message },
                            { status: 500 }
                        )
                    }
                })
            })
            
            return routeBP
        }
    }
}
