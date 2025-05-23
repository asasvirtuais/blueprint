import { renderHook, act, waitFor } from '@testing-library/react'
import { z } from 'zod'
import { blueprint } from './index'
import { reactAddon } from './addons/react'
import './setup-fetch-mock'

describe('echoReactBP.hook', () => {
  const EchoProps = z.object({ message: z.string() })
  const EchoResult = z.object({ echoed: z.string() })
  const echoBlueprint = blueprint({
    propsSchema: EchoProps,
    resultSchema: EchoResult,
    description: 'Echo Service'
  }).setImplementation(async (props: { message: string }) => {
    return { echoed: `Echo: ${props.message}` }
  })
  const echoReactBP = echoBlueprint.addon(reactAddon())

  it('should trigger and return echoed result', async () => {
    const useEcho = echoReactBP.hook()
    const { result } = renderHook(() => useEcho())
    let triggerResult: any
    await act(async () => {
      triggerResult = await result.current({ message: 'From Test' })
    })
    expect(triggerResult).toEqual({ echoed: 'Echo: From Test' })
    // Wait for the state update
    await waitFor(() => {
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeUndefined()
      expect(result.current.result).toEqual({ echoed: 'Echo: From Test' })
    })
  })
})
