export interface NextAddon {

    route(): this
}

export function nextAddon(): NextAddon {
    return {
        route: function() {
            return this
        }
    }
}
