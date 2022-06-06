import { ChainId } from '@sushiswap/chain'
import { Amount, Token } from '@sushiswap/currency'
import { Incentive as IncentiveDTO } from '@sushiswap/graph-client'
import { JSBI } from '@sushiswap/math'

import { toToken } from './mapper'
import { TokenType } from './types'

export class Incentive {
  public readonly id: string
  public readonly tokenType: string
  public readonly rewardAmount: Amount<Token>
  public readonly liquidityStaked: Amount<Token>
  private lastRewardTime: Date
  public readonly startTime: Date
  public readonly endTime: Date
  public readonly createdBy: string
  private _isSubscribed: boolean

  public constructor({ incentive }: { incentive: IncentiveDTO }) {
    this.id = incentive.id
    this._isSubscribed = false
    this.rewardAmount = Amount.fromRawAmount(toToken(incentive.rewardToken, ChainId.KOVAN), incentive.rewardAmount) // TODO: pass in active network to constructor
    this.liquidityStaked = Amount.fromRawAmount(toToken(incentive.stakeToken, ChainId.KOVAN), incentive.liquidityStaked) // TODO: pass in active network to constructor
    this.tokenType = incentive.stakeToken?.type ? (<any>TokenType)[incentive.stakeToken?.type] : TokenType.UNKNOWN // FIXME: any hack?
    this.startTime = new Date(Number(incentive.createdAtTimestamp) * 1000)
    this.lastRewardTime = new Date(Number(incentive.lastRewardTime) * 1000)
    this.endTime = new Date(Number(incentive.endTime) * 1000)
    this.createdBy = incentive.createdBy.id
  }

  public get remainingTime(): { days: number; hours: number; minutes: number; seconds: number } | undefined {
    const now = Date.now()
    const interval = this.isStarted() ? this.endTime.getTime() - now : this.endTime.getTime() - this.startTime.getTime()

    if (interval > 0) {
      const days = Math.floor(interval / (1000 * 60 * 60 * 24))
      const hours = Math.floor((interval % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      const minutes = Math.floor((interval % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((interval % (1000 * 60)) / 1000)

      return { days, hours, minutes, seconds }
    }
    return { days: 0, hours: 0, minutes: 0, seconds: 0 }
  }

  public get rewardsPerDay(): Amount<Token> {
    const now = Date.now()
    const duration = this.isStarted() ? this.endTime.getTime() - now : this.endTime.getTime() - this.startTime.getTime()
    const dayInMs = 1000 * 60 * 60 * 24

    if (duration <= dayInMs) {
      return this.rewardsRemaining
    }
    const days = (duration / dayInMs).toFixed()
    return this.rewardsRemaining.divide(days)
  }

  public get rewardsRemaining(): Amount<Token> {
    const now = Date.now()
    const startTime = JSBI.BigInt(this.startTime.getTime())
    const endTime = JSBI.BigInt(this.endTime.getTime())

    if (this.liquidityStaked.greaterThan(0) && now > this.startTime.getTime()) {
      const duration = JSBI.subtract(endTime, startTime)
      const passed = JSBI.subtract(JSBI.BigInt(now), startTime)
      const rewardsCollected = Amount.fromRawAmount(
        this.rewardAmount.currency,
        JSBI.divide(JSBI.multiply(this.rewardAmount.quotient, passed), duration)
      )
      return this.rewardAmount.subtract(rewardsCollected)
    }
    return this.rewardAmount
  }

  public get isSubscribed(): boolean {
    return this._isSubscribed
  }
  public set isSubscribed(value: boolean) {
    this._isSubscribed = value
  }

  public isStarted(): boolean {
    return this.startTime.getTime() < new Date().getTime()
  }
}