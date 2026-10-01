import type { IOptions, MoveDirection, RecursivePartial } from '@tsparticles/engine'

type Options = RecursivePartial<IOptions>

// The home page's field: white diamonds joined by thin lines, drifting up.
export const home: Options = {
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
      value: 500
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
}

// The same field at rest: shown on a demo only while nothing is running there.
export const threshold: Options = {
  ...home,
  fullScreen: { enable: false },
  fpsLimit: 60,
  interactivity: {
    events: {
      onClick: { enable: false },
      onHover: { enable: false }
    }
  },
  particles: {
    ...home.particles,
    move: {
      ...home.particles?.move,
      speed: 1
    },
    number: {
      density: {
        enable: true
      },
      value: 80
    }
  }
}
