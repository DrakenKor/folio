import Image from 'next/image'
import React, { FC } from 'react'

interface Props {
  className: string
}

const ProfilePhoto: FC<Props> = (props) => (
  <Image
    src="/profile.png"
    alt="profile photo"
    height={500}
    width={500}
    className={`opacity-40 hover:opacity-100 fade duration-1000`}
  />
)

export default ProfilePhoto
