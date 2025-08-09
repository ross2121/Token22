"use client"

import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface PoolData {
  seed: number;
  authority: string;
  mintX: string;
  mintY: string;
  fee: number;
  bump: number;
  config: string;
  lpToken: string;
  vaultX: string;
  vaultY: string;
}

interface PoolContextType {
  pools: PoolData[]
  setPools: React.Dispatch<React.SetStateAction<PoolData[]>>
  selectedPoolSeed: number | null
  setSelectedPoolSeed: React.Dispatch<React.SetStateAction<number | null>>
  addPool: (pool: PoolData) => void
  getPoolBySeed: (seed: number) => PoolData | undefined
}

const PoolContext = createContext<PoolContextType | undefined>(undefined)

export function PoolProvider({ children }: { children: ReactNode }) {
  const [pools, setPools] = useState<PoolData[]>([])
  const [selectedPoolSeed, setSelectedPoolSeed] = useState<number | null>(null)

  const addPool = (pool: PoolData) => {
    setPools(prev => {
      const exists = prev.find(p => p.seed === pool.seed)
      if (!exists) {
        return [...prev, pool]
      }
      // Update existing pool
      return prev.map(p => p.seed === pool.seed ? pool : p)
    })
  }

  const getPoolBySeed = (seed: number) => {
    return pools.find(p => p.seed === seed)
  }

  return (
    <PoolContext.Provider value={{
      pools,
      setPools,
      selectedPoolSeed,
      setSelectedPoolSeed,
      addPool,
      getPoolBySeed
    }}>
      {children}
    </PoolContext.Provider>
  )
}

export function usePool() {
  const context = useContext(PoolContext)
  if (context === undefined) {
    throw new Error('usePool must be used within a PoolProvider')
  }
  return context
}