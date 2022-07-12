import { ChainId } from '@sushiswap/chain'
import { WNATIVE_ADDRESS } from '@sushiswap/core-sdk'

import { getBuiltGraphSDK } from '../../.graphclient'
import { GRAPH_HOST, LEGACY_SUBGRAPH_NAME, TRIDENT_SUBGRAPH_NAME } from '../config'

export const getLegacyPrices = async (chainId: ChainId) => {
  const sdk = await getBuiltGraphSDK({ chainId, host: GRAPH_HOST, name: LEGACY_SUBGRAPH_NAME[chainId] })
  return { chainId, data: await sdk.LegacyTokenPrices() }
}

export const getTridentPrices = async (chainId: ChainId) => {
  const sdk = await getBuiltGraphSDK({ chainId, host: GRAPH_HOST, name: TRIDENT_SUBGRAPH_NAME[chainId] })
  return { chainId, data: await sdk.TridentTokenPrices({ nativeAddress: WNATIVE_ADDRESS[chainId].toLowerCase() }) }
}
