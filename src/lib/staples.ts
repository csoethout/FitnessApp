// Everyday gym exercises (free-exercise-db source ids). Swap suggestions rank these first so you see
// "Hack Squat" before "Jefferson Squats". Data, not logic: extend freely. A test checks every id exists.
export const STAPLE_SOURCE_IDS = new Set(
  `Barbell_Squat Front_Barbell_Squat Dumbbell_Squat Hack_Squat Leg_Press Smith_Machine_Squat Barbell_Lunge Dumbbell_Lunges
  Split_Squat_with_Dumbbells Dumbbell_Rear_Lunge Leg_Extensions Romanian_Deadlift Stiff-Legged_Dumbbell_Deadlift
  Barbell_Deadlift Lying_Leg_Curls Seated_Leg_Curl Standing_Leg_Curl Standing_Calf_Raises Seated_Calf_Raise
  Barbell_Hip_Thrust Barbell_Glute_Bridge
  Barbell_Bench_Press_-_Medium_Grip Barbell_Incline_Bench_Press_-_Medium_Grip Dumbbell_Bench_Press Incline_Dumbbell_Press
  Decline_Dumbbell_Bench_Press Machine_Bench_Press Cable_Crossover Dumbbell_Flyes Butterfly Pushups
  Smith_Machine_Incline_Bench_Press Leverage_Chest_Press Leverage_Incline_Chest_Press Dumbbell_Bench_Press_with_Neutral_Grip
  Dumbbell_Shoulder_Press Barbell_Shoulder_Press Arnold_Dumbbell_Press Machine_Shoulder_Military_Press Leverage_Shoulder_Press
  Side_Lateral_Raise Cable_Seated_Lateral_Raise Front_Dumbbell_Raise Reverse_Machine_Flyes Face_Pull Cable_Rear_Delt_Fly
  Seated_Bent-Over_Rear_Delt_Raise Reverse_Flyes Seated_Dumbbell_Press
  Bent_Over_Barbell_Row Bent_Over_Two-Dumbbell_Row One-Arm_Dumbbell_Row Seated_Cable_Rows T-Bar_Row_with_Handle
  Lying_T-Bar_Row Wide-Grip_Lat_Pulldown Close-Grip_Front_Lat_Pulldown V-Bar_Pulldown Underhand_Cable_Pulldowns Pullups
  Chin-Up Straight-Arm_Pulldown Hyperextensions_Back_Extensions Barbell_Shrug Dumbbell_Shrug Leverage_High_Row Leverage_Iso_Row
  Barbell_Curl Dumbbell_Bicep_Curl Hammer_Curls EZ-Bar_Curl Preacher_Curl Machine_Bicep_Curl
  Cable_Hammer_Curls_-_Rope_Attachment Incline_Dumbbell_Curl Standing_Biceps_Cable_Curl Triceps_Pushdown
  Triceps_Pushdown_-_Rope_Attachment Triceps_Pushdown_-_V-Bar_Attachment EZ-Bar_Skullcrusher
  Cable_Rope_Overhead_Triceps_Extension Close-Grip_Barbell_Bench_Press Standing_Dumbbell_Triceps_Extension
  Machine_Triceps_Extension
  Cable_Crunch Hanging_Leg_Raise Plank Crunches Ab_Roller Ab_Crunch_Machine Decline_Crunch Russian_Twist`.split(/\s+/),
)

/** Unusual or higher-risk variations (several are hard on shoulders). Still searchable, never suggested first. */
export const DISCOURAGED_NAME = /guillotine|behind the neck|behind-the-neck|kipping|muscle up|rope climb|bradford|rocky|with chains|anti-gravity|car drivers/i

/**
 * No-equipment workouts (Plan my week → Away → No gym). Everyday moves only, by muscle group, best first.
 * Data, not logic: free-exercise-db source ids. Chair dips and table rows need only furniture.
 */
export const BODYWEIGHT_STAPLES: Record<string, string[]> = {
  Chest: ['Pushups', 'Push-Up_Wide', 'Decline_Push-Up'],
  Shoulders: ['Decline_Push-Up', 'Push_Up_to_Side_Plank'],
  Arms: ['Bench_Dips', 'Push-Ups_-_Close_Triceps_Position'],
  Back: ['Inverted_Row'],
  Legs: ['Bodyweight_Squat', 'Bodyweight_Walking_Lunge', 'Butt_Lift_Bridge', 'Single_Leg_Glute_Bridge'],
  Core: ['Plank', 'Reverse_Crunch', 'Crunches'],
  Conditioning: ['Mountain_Climbers', 'Freehand_Jump_Squat'],
}
