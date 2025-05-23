import { NextRequest, NextResponse } from 'next/server'
import { Blueprint, Addon } from '@/src/index'

export interface NextAddon {
    // route<T extends NextAddon, Props, Result>(this: T & Blueprint<T, Props, Result>): this
}

export function route<Props, Result>(blueprint: Blueprint<NextAddon, Props, Result>) {
    return async function (request: NextRequest, { params: promise }: { params: Promise<unknown> }) {

        const params = await promise

        const props = {
            ...(typeof params === 'object' ? params : {}),
            ...(['POST', 'PUT', 'PATCH'].includes(request.method) ? { body: await request.json() } : {}),
            ...(['GET', 'DELETE'].includes(request.method) ? Object.fromEntries(request.nextUrl.searchParams.entries()) : {}),
        } as Props

        const result = await blueprint(props)

        return NextResponse.json(result)
    }
}

export const nextAddon: Addon<NextAddon> = {
    core: {
        // todo
        // route() {
        //     return this
        // }
    }
}
