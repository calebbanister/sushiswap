import type { Transaction as TransactionDTO } from '@sushiswap/graph-client'
import { getStreamTransactions } from 'lib'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { chainId, id } = req.query
  const transactions = (await getStreamTransactions(chainId as string, id as string)) as TransactionDTO[]
  res.status(200).send(transactions)
}