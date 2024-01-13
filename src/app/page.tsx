'use client'
import { IOptions, MoveDirection, RecursivePartial } from '@tsparticles/engine'
import Particles, { initParticlesEngine } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim' // if you are going to use `loadSlim`, install the "@tsparticles/slim" package too.
import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
export default function Home() {
  const [initialized, setInitialized] = useState(false)
  useEffect(() => {
    initParticlesEngine(async (engine) => {
      // you can initiate the tsParticles instance (engine) here, adding custom shapes or presets
      // this loads the tsparticles package bundle, it's the easiest method for getting everything ready
      // starting from v2 you can add only the features you need reducing the bundle size
      //await loadAll(engine);
      //await loadFull(engine);
      await loadSlim(engine)
      //await loadBasic(engine);
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
      <h1 className="text-content center text-4xl mt-10 font-extrabold">
        <span className="border-b-[2px]">Manav Da</span>
      </h1>
      <h2 className="text-content center text-3xl mt-10">
        <span className="border-b-[2px]">Software Engineer</span>
      </h2>
      <Particles
        id="particles"
        particlesLoaded={async (container: any) => console.log(container)}
        options={options}
      />
    </>
  ) : (
    <div className="center h-screen">
      <Image
        className="center"
        alt="loading gif"
        src="/loader.gif"
        height={64}
        width={64}
      />
    </div>
  )
}
