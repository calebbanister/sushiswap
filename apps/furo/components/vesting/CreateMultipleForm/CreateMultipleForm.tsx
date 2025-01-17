import { Signature } from '@ethersproject/bytes'
import { AddressZero } from '@ethersproject/constants'
import { ArrowCircleLeftIcon } from '@heroicons/react/outline'
import { yupResolver } from '@hookform/resolvers/yup'
import { Chain } from '@sushiswap/chain'
import { Amount, Native, Type } from '@sushiswap/currency'
import { FundSource } from '@sushiswap/hooks'
import log from '@sushiswap/log'
import { Button, createToast, Dots, Form, Typography } from '@sushiswap/ui'
import { Approve, BENTOBOX_ADDRESS, useFuroVestingContract } from '@sushiswap/wagmi'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { useAccount, useNetwork, useSendTransaction } from 'wagmi'

import { approveBentoBoxAction, batchAction, vestingCreationAction } from '../../../lib'
import {
  CreateMultipleVestingFormData,
  CreateMultipleVestingFormDataTransformed,
  CreateVestingFormData,
  stepConfigurations,
  transformVestingFormData,
} from '../CreateForm'
import { ImportZone } from './ImportZone'
import { createMultipleVestingSchema } from './schema'
import { TableSection } from './TableSection'

export const CreateMultipleForm = () => {
  const { address } = useAccount()
  const { chain: activeChain } = useNetwork()
  const contract = useFuroVestingContract(activeChain?.id)
  const { sendTransactionAsync, isLoading: isWritePending } = useSendTransaction()
  const [signature, setSignature] = useState<Signature>()

  const methods = useForm<CreateMultipleVestingFormData>({
    // @ts-ignore
    resolver: yupResolver(createMultipleVestingSchema),
    defaultValues: {
      vestings: [
        {
          currency: undefined,
          cliff: false,
          startDate: undefined,
          recipient: undefined,
          cliffEndDate: undefined,
          cliffAmount: '',
          stepPayouts: 1,
          stepAmount: '',
          stepConfig: stepConfigurations[0],
          fundSource: undefined,
          insufficientBalance: false,
        },
      ],
    },
    mode: 'onChange',
  })

  const {
    formState: { isValid, isValidating },
    reset,
    watch,
  } = methods

  const formData = watch()

  const onSubmit = useCallback(
    async (data: CreateMultipleVestingFormDataTransformed | undefined) => {
      if (!contract || !address || !activeChain?.id || !data) return

      const summedValue = data.vestings.reduce<Amount<Native>>((acc, cur) => {
        if (cur.totalAmount?.currency?.isNative) {
          console.log(acc.currency, cur.totalAmount.currency)
          acc = acc.add(cur.totalAmount as Amount<Native>)
        }

        return acc
      }, Amount.fromRawAmount(Native.onChain(activeChain.id), '0'))

      const actions = [
        approveBentoBoxAction({ contract, user: address, signature }),
        ...data.vestings.reduce<string[]>((acc, cur) => {
          if (
            cur?.recipient &&
            cur?.currency &&
            cur?.startDate &&
            cur?.cliffDuration &&
            cur?.stepConfig?.time &&
            cur?.stepPercentage &&
            cur?.totalAmount &&
            cur?.stepPayouts
          ) {
            acc.push(
              vestingCreationAction({
                contract,
                recipient: cur.recipient,
                currency: cur.currency,
                startDate: new Date(cur.startDate),
                cliffDuration: cur.cliffDuration.toString(),
                stepDuration: cur.stepConfig?.time.toString(),
                steps: cur.stepPayouts.toString(),
                stepPercentage: cur.stepPercentage.toString(),
                amount: cur.totalAmount.quotient.toString(),
                fromBentobox: cur.fundSource === FundSource.BENTOBOX,
              })
            )
          }
          return acc
        }, []),
      ]

      try {
        const resp = await sendTransactionAsync({
          request: {
            from: address,
            to: contract.address,
            data: batchAction({ contract, actions }),
            value: summedValue.quotient.toString(),
          },
        })

        createToast({
          txHash: resp.hash,
          href: Chain.from(activeChain.id).getTxUrl(resp.hash),
          promise: resp.wait(),
          summary: {
            pending: (
              <Dots>
                Creating {data.vestings.length} stream{data.vestings.length > 0 ? 's' : ''}
              </Dots>
            ),
            completed: `Successfully created ${data.vestings.length} stream${data.vestings.length > 0 ? 's' : ''}`,
            failed: 'Something went wrong creating vestings',
          },
        })
      } catch (e: any) {
        console.log(contract.address, batchAction({ contract, actions }), summedValue.quotient.toString())
        log.tenderly({
          chainId: activeChain?.id,
          from: address,
          to: contract.address,
          data: batchAction({ contract, actions }),
          value: summedValue.quotient.toString(),
        })
      }
    },
    [address, activeChain?.id, contract, sendTransactionAsync, signature]
  )

  const validatedData: CreateMultipleVestingFormDataTransformed | undefined = useMemo(() => {
    if (!isValid || isValidating) return undefined
    return {
      ...formData,
      vestings: formData.vestings.map((vest) => transformVestingFormData(vest as CreateVestingFormData)),
    }
  }, [formData, isValid, isValidating])

  useEffect(() => {
    reset()

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChain?.id, address])

  // createMultipleVestingSchema
  //   .validate(formData, { abortEarly: false })
  //   .then(function () {
  //     console.log('valid')
  //   })
  //   .catch(function (err) {
  //     err?.inner?.forEach((e: any) => {
  //       console.log(e.message, e.path)
  //     })
  //   })

  const summedAmounts = validatedData
    ? Object.values(
        validatedData.vestings.reduce<Record<string, Amount<Type>>>((acc, cur) => {
          if (!cur.totalAmount) return acc
          const address = cur.totalAmount.currency.isNative ? AddressZero : cur.totalAmount.currency.address
          if (acc[address]) {
            acc[address] = acc[address].add(cur.totalAmount)
          } else {
            acc[address] = cur.totalAmount
          }

          return acc
        }, {})
      )
    : []

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(() => onSubmit(validatedData))}>
        <div className="flex flex-col mt-10 gap-20">
          <Link href="/vesting/create" passHref={true}>
            <a>
              <button className="group hover:text-white text-slate-200 flex gap-3 font-medium">
                <ArrowCircleLeftIcon width={24} height={24} /> <span>Create Vesting</span>
              </button>
            </a>
          </Link>
          <div className="flex flex-col md:grid md:grid-cols-[296px_auto] gap-y-10 lg:gap-20">
            <ImportZone />
            <div className="flex flex-col gap-4 col-span-2">
              <Typography weight={500}>Vestings</Typography>
              <TableSection />
              <Form.Buttons className="flex flex-col items-end gap-3">
                <Approve
                  className="!items-end"
                  components={
                    <Approve.Components>
                      <Approve.Bentobox address={contract?.address} onSignature={setSignature} />
                      {summedAmounts.map((amount, index) => (
                        <Approve.Token
                          key={index}
                          amount={amount}
                          address={activeChain?.id ? BENTOBOX_ADDRESS[activeChain.id] : undefined}
                        />
                      ))}
                    </Approve.Components>
                  }
                  render={({ approved }) => {
                    return (
                      <Button
                        type="submit"
                        variant="filled"
                        color="gradient"
                        disabled={
                          formData?.vestings?.length === 0 || isWritePending || !approved || !isValid || isValidating
                        }
                      >
                        {isWritePending ? <Dots>Confirm transaction</Dots> : 'Create Vestings'}
                      </Button>
                    )
                  }}
                />
              </Form.Buttons>
            </div>
          </div>
        </div>
      </form>
    </FormProvider>
  )
}
