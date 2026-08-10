import { AppServiceProvider } from '@/app/app-service.tsx'
import { AppRouter } from '@/app/router.tsx'

function App() {
  return (
    <AppServiceProvider>
      <AppRouter />
    </AppServiceProvider>
  )
}

export default App
