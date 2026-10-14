import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/AppLayout'
import { DataProvider } from '@/data/DataProvider'
import { DayEditorScreen } from '@/screens/DayEditorScreen'
import { FoodScreen } from '@/screens/FoodScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { ProgressScreen } from '@/screens/ProgressScreen'
import { SignInScreen } from '@/screens/SignInScreen'
import { TodayScreen } from '@/screens/TodayScreen'
import { TrainScreen } from '@/screens/TrainScreen'
import './index.css'

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInScreen /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: (
          <DataProvider>
            <AppLayout />
          </DataProvider>
        ),
        children: [
          { path: '/', element: <TodayScreen /> },
          { path: '/train', element: <TrainScreen /> },
          { path: '/train/day/:dayId', element: <DayEditorScreen /> },
          { path: '/food', element: <FoodScreen /> },
          { path: '/progress', element: <ProgressScreen /> },
          { path: '/more', element: <MoreScreen /> },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
)
