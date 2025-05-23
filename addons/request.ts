import { Addon, Blueprint } from "../index"

export interface RequestProps {
    url: string
    method?: string
    body?: any
    query?: Record<string, string>
}

export interface RequestAddon {
    request <T extends RequestAddon, Props, Result>(this: T & Blueprint<T, Props, Promise<Result>>, url: string): T & Blueprint<T, Props, Promise<Result>>
}

export const requestAddon : Addon<RequestAddon> = {
    core: {
        // @ts-expect-error haunted by the subtype error
        request<
            T extends RequestAddon,
            Props,
            Result
        >(
            this: T & Blueprint<T, Props, Result>,
            url: string
        ) {
            return this.mod(
                () => (
                    (props: any) => (
                            fetch(url, {
                                method: props.method || "GET",
                                body: props.body ? JSON.stringify(props.body) : undefined,
                                headers: {
                                    "Content-Type": "application/json"
                                },
                            }).then(response => {
                                return response.json()
                            }
                        )
                    )
                )
            )
        }
    }
}