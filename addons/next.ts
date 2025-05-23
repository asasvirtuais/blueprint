import { NextRequest, NextResponse } from 'next/server'
import { Blueprint, Addon } from '../index'
import { asyncAddon } from './async'

export interface NextAddon {
    route<T extends NextAddon, Props, Result>(this: T & Blueprint<T, Props, Promise<Result>>): T & Blueprint<T, Props, Promise<Result>>
}

export const nextAddon: Addon<NextAddon> = {
    core: {
        route() {
            return (request: NextRequest, { params }: { params: Promise<unknown> } ) => {
                return this.addon(asyncAddon).async()
                .mod(blueprint => (props) => {
                    props.request = request
                    props.params = params
                    return blueprint(props)
                })
            }
        }
    }
}
