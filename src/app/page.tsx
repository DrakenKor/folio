'use client'
import { IOptions, MoveDirection, RecursivePartial } from '@tsparticles/engine'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim' // if you are going to use `loadSlim`, install the "@tsparticles/slim" package too.
import { useEffect, useMemo, useState } from 'react'
import RubiLoader from './components/Loaders/RubiLoader'
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
      <div className="center mt-8">
        <div className="grid gap-4 grid-cols-8 mt-5 w-[80vw] min-h-[75vh]">
          <div className="col-span-2 min-h-full p-5">
            <p className="text-xl">About Me</p>
            <p className="tracking-wider">
              I&apos;m a software engineer and seeker that enjoys solving
              complex problems. I love working with like minded people in
              tackling hard problems, and coming up with novel and creative
              solutions. I&apos;m a big fan of open source software.
            </p>
            <p></p>
            <p className="pt-10 center">
              <a
                href="https://www.linkedin.com/in/manav-dhindsa/"
                target="_blank"
                className="border-b-2 border-white hover:border-gray-500">
                LinkedIn Profile
              </a>
            </p>
          </div>
          <div className="col-span-4 p-5">
            <div className="center text-xl">Skills</div>
          </div>
          <div className="col-span-2 p-5">
            <p className="text-xl center">Stuff I Like</p>
            <div className="center flex flex-wrap space-x-4 text-xs">
              <a
                href="https://xkcd.com/"
                target="_blank"
                className="border-b-2 border-white hover:border-gray-500">
                XKCD
              </a>
              <a
                href="https://pbfcomics.com/"
                target="_blank"
                className="border-b-2 border-white hover:border-gray-500">
                PBF
              </a>
              <a
                href="https://www.pathofexile.com/"
                target="_blank"
                className="border-b-2 border-white hover:border-gray-500">
                POE
              </a>
            </div>
          </div>
          <div className="p-5">
            <span className="border-b-2 border-white hover:border-gray-500 hover:text-gray-500 hover:cursor-pointer">
              Contact Me
            </span>
          </div>
        </div>
      </div>
      <Particles
        id="particles"
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
