'use client'
import { IOptions, MoveDirection, RecursivePartial } from '@tsparticles/engine'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim' // if you are going to use `loadSlim`, install the "@tsparticles/slim" package too.
import { useEffect, useMemo, useState } from 'react'
import RubiLoader from './components/Loaders/RubiLoader'
import ProfilePhoto from './components/Svg/ProfilePhoto'
import { CiLinkedin } from 'react-icons/ci'
import { FaGithubSquare } from 'react-icons/fa'

export default function Home() {
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine)
    }).then(() => setInitialized(true))
  }, [])
  const options: RecursivePartial<IOptions> = useMemo(
    () => ({
      background: {
        color: {
          value: '#000'
        }
      },
      fpsLimit: 120,
      interactivity: {
        detectsOn: 'window',
        events: {
          onClick: {
            enable: true,
            mode: 'push'
          },
          onHover: {
            enable: true,
            mode: 'repulse'
          }
        },
        modes: {
          push: {
            quantity: 12
          },
          repulse: {
            distance: 120,
            duration: 1,
            speed: 0.5,
            maxSpeed: 1,
            easing: 'ease-out-cubic'
          }
        }
      },
      particles: {
        color: {
          value: '#ffffff'
        },
        links: {
          color: '#ffffff',
          distance: 80,
          enable: true,
          opacity: 0.25,
          width: 1.5
        },
        move: {
          direction: 'top' as MoveDirection,
          enable: true,
          outModes: {
            default: 'bounce'
          },
          random: true,
          speed: 4,
          straight: false
        },
        number: {
          density: {
            enable: true
          },
          value: 160
        },
        opacity: {
          value: 0.5
        },
        shape: {
          type: 'diamond'
        },
        size: {
          value: { min: 0.1, max: 4 }
        }
      },
      detectRetina: true,
      smooth: true
    }),
    []
  )
  return initialized ? (
    <>
      <h1 className="center mt-5">
        <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200 shadow-inner">
          Manav Da
        </span>
      </h1>
      <h2 className="center mt-2">
        <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-200">
          Software Engineer
        </span>
      </h2>
      <div className="center mt-16">
        <ProfilePhoto className="w-64 h-64" />
      </div>
      <div className="center flex flex-row justify-center mt-16 gap-x-4">
        <a href="https://www.linkedin.com/in/manav-dhindsa/" target="_blank">
          <CiLinkedin className="w-8 h-8 cursor-pointer" />
        </a>
        <a
          href="https://github.com/DrakenKor"
          target="_blank"
          aria-label="a wasteland">
          <FaGithubSquare className="w-8 h-8" />
        </a>
      </div>
      <Particles
        id="particles"
        className="z-0"
        particlesLoaded={async (container: any) => {}}
        options={options}
      />
    </>
  ) : (
    <div className="center h-screen">
      <RubiLoader type="white" height={32} width={32} />
    </div>
  )
}
