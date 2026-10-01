'use client'
import Particles, { ParticlesProvider } from '@tsparticles/react'
import { loadSlim } from '@tsparticles/slim' // if you are going to use `loadSlim`, install the "@tsparticles/slim" package too.
import { ViewTransition, useEffect, useState } from 'react'
import Link from 'next/link'
import { home } from '@/lib/constellation'
import { demos, leavingDemo, markLeavingDemo, titleTransitionName } from '@/lib/demos'
import RubiLoader from './components/Loaders/RubiLoader'
import ProfilePhoto from './components/Svg/ProfilePhoto'
import { CiLinkedin } from 'react-icons/ci'
import { FaGithubSquare } from 'react-icons/fa'
import XkcdIcon from './components/Svg/XkcdIcon'

export default function Home() {
  // Arriving back from a demo: its title travels to its place in the list, so
  // the list has to be there at once instead of behind the loader.
  const [returning] = useState(leavingDemo)
  const [initialized, setInitialized] = useState(returning !== null)
  // The label that travels: the demo just left, or the one just clicked.
  // Only that one is named, so no other navigation starts a view transition.
  const [travelling, setTravelling] = useState(returning)

  useEffect(() => {
    if (returning !== null) {
      markLeavingDemo(null)
      return
    }
    let mounted = true

    // Reset initialization state on mount (handles bfcache restoration)
    setInitialized(false)

    const timeoutId = setTimeout(() => {
      if (mounted) {
        setInitialized(true)
      }
    }, 2000)

    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [returning])

  // Handle browser back/forward navigation (bfcache restoration)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        // Page was restored from bfcache, force re-initialization
        setInitialized(false)
        // Trigger re-initialization after a brief delay
        setTimeout(() => {
          setInitialized(true)
        }, 100)
      }
    }

    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])
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
        <ProfilePhoto className="w-64 h-96" />
      </div>
      <div className="center flex flex-row justify-center mt-8 gap-x-4">
        <a href="https://www.linkedin.com/in/manav-dhindsa/" target="_blank">
          <CiLinkedin className="w-8 h-8 cursor-pointer" />
        </a>
        <a
          href="https://github.com/manavdia"
          target="_blank"
          aria-label="a wasteland">
          <FaGithubSquare className="w-8 h-8" />
        </a>
        <a href="https://xkcd.com" target="_blank">
          <XkcdIcon className="w-8 h-8" />
        </a>
        <Link
          href="/blog"
          className="inline-flex h-8 items-center opacity-40 hover:opacity-100 fade duration-1000 text-center leading-none hover:underline">
          <span className="underline">Blog</span>
        </Link>
      </div>
      
      <div className="center mt-16 flex flex-col">
        <p className="text-lg mb-6">Interactive Demos</p>
        <div className="center flex flex-col space-y-2 max-w-md">
          {demos.map(demo => (
            <Link
              key={demo.slug}
              href={demo.route}
              prefetch={false}
              onClick={() => setTravelling(demo.slug)}
              className="opacity-40 hover:opacity-100 fade duration-1000 text-center hover:underline">
              {travelling === demo.slug ? (
                <ViewTransition name={titleTransitionName(demo.slug)} share="demo-title-travel">
                  <span className="underline">{demo.title}</span>
                </ViewTransition>
              ) : (
                <span className="underline">{demo.title}</span>
              )}
              &nbsp;
              <span className="text-sm text-gray-400">{demo.line}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="center mt-10 flex flex-col">
        <p className="text-lg">Profile Stack</p>
        <div className="center flex flex-col">
          <p className="opacity-40 hover:opacity-100 fade duration-1000">
            <span className="underline">Host</span>
            &nbsp;
            <span>Github Pages</span>
          </p>
          <p className="opacity-40 hover:opacity-100 fade duration-1000">
            <span className="underline">CICD</span>
            &nbsp;
            <span>Github Actions</span>
          </p>
          <p className="opacity-40 hover:opacity-100 fade duration-1000">
            <span className="underline">Framework</span>
            &nbsp;
            <span>NextJS Typescript</span>
          </p>
          <p className="opacity-40 hover:opacity-100 fade duration-1000">
            <span className="underline">Domain Registrar</span>
            &nbsp;
            <span>AWS Route 53</span>
          </p>
        </div>
      </div>


      <ParticlesProvider init={loadSlim}>
        <Particles
          id="particles"
          className="z-0"
          options={home}
        />
      </ParticlesProvider>
    </>
  ) : (
    <div className="center h-screen bg-black">
      <RubiLoader type="white" height={32} width={32} />
    </div>
  )
}
