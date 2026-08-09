import { router, type Href } from 'expo-router';

export type AppEntryTarget = {
  loggedIn: boolean;
  /** When logged in and profile known empty — land on display-name, not Maison. */
  needsDisplayName?: boolean;
};

/** Single source for post-auth / cold-start destinations. */
export function appEntryHref(target: AppEntryTarget): Href {
  if (!target.loggedIn) return '/login';
  if (target.needsDisplayName) return '/display-name';
  return '/(tabs)/maison';
}

/**
 * Hard-reset navigation so a stale restored stack cannot leave the user
 * stuck on +not-found (where "Go to home" alone is not enough).
 */
export function resetToAppEntry(target: boolean | AppEntryTarget): void {
  const entry: AppEntryTarget =
    typeof target === 'boolean' ? { loggedIn: target } : target;
  try {
    while (router.canDismiss()) {
      router.dismiss();
    }
  } catch {
    /* canDismiss may throw before the navigator is ready */
  }
  router.replace(appEntryHref(entry));
}
