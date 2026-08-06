import { router } from 'expo-router';

/**
 * Hard-reset navigation so a stale restored stack cannot leave the user
 * stuck on +not-found (where "Go to home" alone is not enough).
 */
export function resetToAppEntry(loggedIn: boolean): void {
  try {
    while (router.canDismiss()) {
      router.dismiss();
    }
  } catch {
    /* canDismiss may throw before the navigator is ready */
  }
  router.replace(loggedIn ? '/(tabs)/maison' : '/login');
}
