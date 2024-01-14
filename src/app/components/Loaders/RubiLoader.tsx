import React, { FC } from 'react'
import Image from 'next/image'
interface Props {
  height?: number
  width?: number
  className?: string
  type: 'black' | 'white'
}
const RubiLoader: FC<Props> = ({ height, width, className, type }) => (
  <Image
    className={className || 'center'}
    alt="loading gif"
    src={type === 'black' ? '/loader_black.gif' : '/loader.gif'}
    height={height || 16}
    width={width || 16}
  />
)
export default RubiLoader
