import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { ConfirmProvider } from '@/components/ConfirmProvider'
import { RequireAuth } from '@/auth/RequireAuth'
import { AppLayout } from '@/components/AppLayout'
import { DataProvider } from '@/data/DataProvider'
import { DayEditorScreen } from '@/screens/DayEditorScreen'
import { FoodScreen } from '@/screens/FoodScreen'
import { GymScreen } from '@/screens/GymScreen'
import { HistoryScreen } from '@/screens/HistoryScreen'
import { SavedMealsScreen } from '@/screens/SavedMealsScreen'
import { MealEditorScreen } from '@/screens/MealEditorScreen'
import { WeekPlanScreen } from '@/screens/WeekPlanScreen'
import { GymsScreen } from '@/screens/GymsScreen'
import { NutritionPlanScreen } from '@/screens/NutritionPlanScreen'
import { MoreScreen } from '@/screens/MoreScreen'
import { ProgressScreen } from '@/screens/ProgressScreen'
import { SignInScreen } from '@/screens/SignInScreen'
import { SummaryScreen } from '@/screens/SummaryScreen'
import { TodayScreen } from '@/screens/TodayScreen'
import { TrainScreen } from '@/screens/TrainScreen'
import { WorkoutScreen } from '@/screens/WorkoutScreen'

// Charts library only loads when a lift's detail page is opened.
// eslint-disable-next-line react/only-export-components
const ExerciseProgressScreen = lazy(() => import('@/screens/ExerciseProgressScreen'))
import './index.css'

const router = createBrowserRouter([
  { path: '/sign-in', element: <SignInScreen /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: (
          <DataProvider>
            <Outlet />
          </DataProvider>
        ),
        children: [
          // Full-screen logger: no tab bar, so every pixel goes to the sets.
          { path: '/workout/:workoutId', element: <WorkoutScreen /> },
          {
            element: <AppLayout />,
            children: [
          { path: '/', element: <TodayScreen /> },
          { path: '/train', element: <TrainScreen /> },
          { path: '/train/day/:dayId', element: <DayEditorScreen /> },
              { path: '/train/week', element: <WeekPlanScreen /> },
              { path: '/history', element: <HistoryScreen /> },
              { path: '/history/:workoutId', element: <SummaryScreen /> },
          { path: '/food', element: <FoodScreen /> },
              { path: '/food/plan', element: <NutritionPlanScreen /> },
              { path: '/food/meals', element: <SavedMealsScreen /> },
              { path: '/food/meals/:mealId', element: <MealEditorScreen /> },
          { path: '/progress', element: <ProgressScreen /> },
              {
                path: '/progress/exercise/:exerciseId',
                element: (
                  <Suspense fallback={<p className="text-muted">Loading…</p>}>
                    <ExerciseProgressScreen />
                  </Suspense>
                ),
              },
          { path: '/more', element: <MoreScreen /> },
              { path: '/more/gym', element: <GymScreen /> },
              { path: '/more/gym/:gymId', element: <GymScreen /> },
              { path: '/more/gyms', element: <GymsScreen /> },
            ],
          },
        ],
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <ConfirmProvider>
        <RouterProvider router={router} />
      </ConfirmProvider>
    </AuthProvider>
  </StrictMode>,
)
