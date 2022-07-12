import 'dotenv/config'

import { ChainId } from '@sushiswap/chain'
import { getUnixTime } from 'date-fns'

import { LEGACY_SUPPORTED_CHAINS, TRIDENT_SUPPORTED_CHAINS } from './config'
import { getLegacyPrices, getTridentPrices } from './lib/graph'
import redis from './lib/redis'

async function legacyPrices() {
  const results = await Promise.all(LEGACY_SUPPORTED_CHAINS.map((chainId) => getLegacyPrices(chainId)))
  console.log(results[0].data.legacy_exchange_tokens.length)
  return Object.fromEntries(
    results.map(({ chainId, data }) => {
      const ethPrice = data.legacy_exchange_bundle?.ethPrice
      const updatedAtBlock = data.legacy_exchange__meta?.block.number
      const updatedAtTimestamp = getUnixTime(Date.now())
      return [
        chainId,
        JSON.stringify({
          chainId,
          ...Object.fromEntries(
            data.legacy_exchange_tokens
              .filter((token) => token.derivedETH != 0)
              .map((token) => {
                const price = Number(token.derivedETH) * Number(ethPrice)
                return [token.id, price]
              })
          ),
          updatedAtBlock,
          updatedAtTimestamp,
        }),
      ]
    })
  )
}

async function tridentPrices() {
  const results = await Promise.all(TRIDENT_SUPPORTED_CHAINS.map((chainId) => getTridentPrices(chainId)))
  return Object.fromEntries(
    results.map(({ chainId, data }) => {
      const nativePrice = data.trident_tokenPrice?.derivedUSD
      const updatedAtBlock = data.trident__meta?.block.number
      const updatedAtTimestamp = getUnixTime(Date.now())
      return [
        chainId,
        // JSON.stringify({
        //   chainId,
        //   ...Object.fromEntries(data.trident_tokenPrices.filter(token)),
        // }),
      ]
    })
  )
}

export async function execute() {
  console.log(
    `Updating prices for chains: ${[...LEGACY_SUPPORTED_CHAINS, ...TRIDENT_SUPPORTED_CHAINS]
      .map((chainId) => ChainId[chainId])
      .join(', ')}`
  )
  const [legacyResults, tridentResults] = await Promise.all([legacyPrices(), tridentPrices()])
  process.exit()
  await redis.hset('prices', legacyResults)
  console.log(`Finished updating prices`)
  process.exit()
}
execute()
