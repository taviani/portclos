/**
 * Dynamic Expo config. EAS `owner` / `projectId` come from env only
 * (local `.env` or CI secrets) — never commit them in app.json.
 *
 * After a one-time `eas init`, copy the printed IDs into `.env` and
 * discard any app.json changes. Do not re-run `eas init`.
 */
module.exports = ({ config }) => {
  const owner = process.env.EXPO_OWNER?.trim();
  const projectId = process.env.EXPO_PROJECT_ID?.trim();

  const extra = { ...(config.extra || {}) };
  const easExtra =
    extra.eas && typeof extra.eas === 'object' && !Array.isArray(extra.eas)
      ? { ...extra.eas }
      : {};

  // Prefer env; strip any values eas init may have written into app.json
  // so a dirty local app.json is not required for builds.
  delete easExtra.projectId;
  if (projectId) {
    easExtra.projectId = projectId;
  }
  extra.eas = easExtra;

  const next = { ...config, extra };
  delete next.owner;
  if (owner) {
    next.owner = owner;
  }
  return next;
};
