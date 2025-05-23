'use client'

import React, { useEffect, useState } from 'react'
import { hook } from '@/addons/react'
import { requestAddon } from '@/addons/request'
import { helloBlueprint } from './tools/hello'
// Define a blueprint for fetching data
const requestBP = helloBlueprint
    .addon(requestAddon)
    .request('/api/hello')

  // Create a React hook from the blueprint
const useGreeting = hook(requestBP)

export default function HomePage() {
  const { result, loading, error, trigger } = useGreeting({ name: 'World' })

  useEffect(() => {
    trigger()
  }, [])

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <h1>Greeting</h1>
      {result && <p>{result.message}</p>}
      <button onClick={() => trigger({ name: 'Next.js User' })}>Refresh Greeting</button>
    </div>
  )
}
