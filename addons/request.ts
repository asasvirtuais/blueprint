import { Addon, Blueprint } from "../index"

export interface RequestAddon {
    request<T extends RequestAddon, Props, Result>(
        this: T & Blueprint<Props, Result, (props: Props) => Promise<Result>, T>,
        url: string
    ): this
}

export const requestAddon = (): Addon<RequestAddon> => ({
    core: {
        request(url) {
            return this.mod((currentBP) => {
                return currentBP.setImplementation(async (props) => {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(props)
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