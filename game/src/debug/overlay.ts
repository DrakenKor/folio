let toastTimer: ReturnType<typeof setTimeout> | undefined

export function toast(message: string): void {
  let element = document.getElementById('toast')
  if (!element) {
    element = document.createElement('div')
    element.id = 'toast'
    element.setAttribute('role', 'status')
    document.body.append(element)
  }
  element.textContent = message
  element.hidden = false
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { element.hidden = true }, 3500)
}

export function graphicsStopped(): void {
  const overlay = document.createElement('div')
  overlay.id = 'graphics-stopped'
  overlay.setAttribute('role', 'alert')
  const message = document.createElement('p')
  message.textContent = 'Graphics stopped'
  const reload = document.createElement('button')
  reload.textContent = 'Reload'
  reload.onclick = () => {
    const url = new URL(location.href)
    url.hash = ''
    url.searchParams.delete('fresh')
    location.replace(url)
  }
  overlay.append(message, reload)
  document.body.append(overlay)
  reload.focus()
}
