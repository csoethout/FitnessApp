// Gym presets (data): what a typical place has. Used when adding a gym and by the setup wizard.
export const GYM_PRESETS: { label: string; detail: string; equipment: string[] }[] = [
  { label: 'Full gym', detail: 'Barbells, dumbbells, cables, machines', equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'body only', 'e-z curl bar', 'kettlebells', 'other'] },
  { label: 'Hotel gym', detail: 'Dumbbells, a cable station, a few machines', equipment: ['dumbbell', 'machine', 'cable', 'body only'] },
  { label: 'Home', detail: 'Dumbbells and bands', equipment: ['dumbbell', 'bands', 'body only'] },
  { label: 'Bodyweight only', detail: 'No equipment', equipment: ['body only'] },
]
