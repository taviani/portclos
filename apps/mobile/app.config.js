/**
 * Dynamic Expo config. EAS `owner` / `projectId` come from env only
 * (local `.env` or CI secrets) — never commit them in app.json.
 *
 * For `eas build` / `eas submit`, set EXPO_OWNER + EXPO_PROJECT_ID in
 * apps/mobile/.env (see .env.example). Do not re-run `eas init`
 * (it cannot write into app.config.js).
 */
const { loadProjectEnv } = require('@expo/env');

// eas-cli does not always load .env before evaluating this file
loadProjectEnv(__dirname, { silent: true });

module.exports = ({ config }) => {
  const owner = process.env.EXPO_OWNER?.trim();
  const projectId = process.env.EXPO_PROJECT_ID?.trim();

  const extra = { ...(config.extra || {}) };
  const easExtra =
    extra.eas && typeof extra.eas === 'object' && !Array.isArray(extra.eas)
      ? { ...extra.eas }
      : {};

  // Prefer env; ignore any values eas may have written into app.json.
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
