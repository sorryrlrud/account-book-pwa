export function registerAppServiceWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return
  }

  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller)
  let isReloading = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadControllerAtStartup || isReloading) return
    isReloading = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
      })
      .then((registration) => {
        const update = () => {
          if (document.visibilityState === 'visible') {
            void registration.update()
          }
        }

        update()
        document.addEventListener('visibilitychange', update)
      })
      .catch(() => {
        // The application remains usable online when service worker setup fails.
      })
  })
}
