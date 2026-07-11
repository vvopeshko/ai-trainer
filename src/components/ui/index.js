// AI Trainer · Glass design system — barrel export

// Primitives
export { Glass } from './Glass.jsx'
export { Mesh } from './Mesh.jsx'
export { Button } from './Button.jsx'
export { Skeleton } from './Skeleton.jsx'

// Icons
export { Icon, ICON_PATHS } from './Icon.jsx'

// Cards
export { StatTile } from './StatTile.jsx'
export { ActivePill } from './ActivePill.jsx'

// Workout
export { RestCard } from './RestCard.jsx'
export { SwipeRow } from './SwipeRow.jsx'

// Nav
export { GlassNav } from './GlassNav.jsx'

// Notify
export { GlassAINote } from './GlassAINote.jsx'

// Dialogs
export { ConfirmDialog } from './ConfirmDialog.jsx'
export { BottomSheet } from './BottomSheet.jsx'

// Visualization (lazy: body-muscles ~26 KB — отдельный async-чанк, не в main)
export { BodyMap } from './BodyMapLazy.jsx'

// Layout
export { TopBar } from './TopBar.jsx'
export { BigStepper } from './BigStepper.jsx'

// Exercise Detail (lazy: ~18 KB — тянется только при первом открытии шита)
export { ExerciseDetailSheet } from './ExerciseDetailSheetLazy.jsx'

// Toast
export { ToastProvider, useToast } from './Toast.jsx'
