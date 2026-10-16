// The guided tour (data): each step opens a screen, highlights one element (data-tour="…") and explains it.
// Steps for switched-off features are left out; a step whose element isn't on screen is shown without a highlight.
import type { FeatureKey } from './features'

export type TourStep = { route: string; target: string | null; title: string; text: string; feature?: FeatureKey }

export const TOUR_STEPS: TourStep[] = [
  { route: '/', target: null, title: 'Quick tour', text: "I'll show you around the real screens. It takes about a minute. Tap Next to move on, or Skip any time." },
  { route: '/', target: 'today-workout', title: "Today's workout", text: 'Tap Start and the logger opens with every set filled in with today\'s target. Tap ✓ to log a set as is, or tap a number to change it.' },
  { route: '/', target: 'today-weight', title: 'Weigh in', text: 'One tap each morning. The app uses your 7-day average, so daily ups and downs don\'t matter.', feature: 'body' },
  { route: '/', target: 'today-sleep', title: 'Sleep', text: 'Log when you went to bed and woke up. It remembers last night\'s times, so most mornings it\'s one tap.', feature: 'sleep' },
  { route: '/', target: 'today-water', title: 'Water', text: 'Tap a glass or your bottle as you drink. Tap the numbers to change your goal or bottle size.', feature: 'water' },
  { route: '/', target: 'today-cardio', title: 'Cardio', text: '"Walk" repeats your usual walk in one tap. "Other" is for runs, bikes and anything else.', feature: 'cardio' },
  { route: '/', target: 'today-food', title: 'Food at a glance', text: 'Calories and protein left for today. Tap it to open the food log.', feature: 'food' },
  { route: '/train', target: 'train-week', title: 'Your week', text: 'Your training days. Tap a day to change exercises, sets, reps or the main lift.' },
  { route: '/train', target: 'train-areas', title: 'Body areas', text: "Don't want to train legs, or want more arms? Skip or focus on an area and rebuild your week around it." },
  { route: '/train', target: 'train-plan-week', title: 'Plan my week', text: 'Busy day, short on time, or travelling? Mark it here and the week rearranges itself.', feature: 'planWeek' },
  { route: '/train', target: 'train-history', title: 'Past workouts', text: 'Every finished workout, with PRs and your estimated 1-rep max per lift.' },
  { route: '/food', target: 'food-meters', title: 'Calories and protein', text: 'How much is left today. Carbs and fat are underneath; protein matters most.', feature: 'food' },
  { route: '/food', target: 'food-add', title: 'Add food', text: 'Pick from recent foods, search, scan a barcode or type the label. Meals you repeat can be saved as one tap.', feature: 'food' },
  { route: '/food', target: 'food-plan', title: 'Your targets', text: 'How your calories were worked out. Every 2 weeks the app checks your weight trend and suggests a small change.', feature: 'food' },
  { route: '/progress', target: 'progress-week', title: 'This week', text: 'Hard sets per muscle group. Around 10 a week per muscle is a good target.' },
  { route: '/progress', target: 'progress-lifts', title: 'Your lifts', text: 'Each lift\'s trend. Tap one for its chart, best sets and history.' },
  { route: '/progress', target: 'progress-tabs', title: 'Body', text: 'Switch to Body for your weight trend and sleep.' },
  { route: '/more', target: 'more-features', title: 'Make it yours', text: "Turn off anything you don't use. It's hidden, never deleted." },
  { route: '/more', target: 'more-setup', title: 'Change your plan', text: 'Run setup again to change your goal, schedule or gym. Your gyms and data export are here too.' },
  { route: '/', target: 'nav', title: "You're set", text: 'Five tabs, always at the bottom. You can replay this tour from More → Take the tour.' },
]
