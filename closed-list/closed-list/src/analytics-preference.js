const STORAGE_KEY = "inprogress.analyticsExcluded";

// Run before Analytics mounts so the activation visit is excluded too.
export function configureAnalyticsPreference(browser = window) {
  const url = new URL(browser.location.href);
  const choice = url.searchParams.get("analytics");
  let excluded = false;
  let saved = true;
  try {
    if (choice === "off") browser.localStorage.setItem(STORAGE_KEY, "1");
    if (choice === "on") browser.localStorage.removeItem(STORAGE_KEY);
    excluded = browser.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    saved = false;
  }
  if (choice === "off") excluded = true;
  if (choice === "on") excluded = false;
  if (choice === "off" || choice === "on") {
    url.searchParams.delete("analytics");
    browser.history.replaceState(browser.history.state, "", url.href);
  }
  return { excluded, choice, saved };
}

export function filterAnalyticsEvent(event, preference, storage) {
  try {
    const currentStorage = storage ?? window.localStorage;
    const excluded = preference.saved
      ? currentStorage.getItem(STORAGE_KEY) === "1"
      : preference.excluded;
    return excluded ? null : event;
  } catch {
    return preference.excluded ? null : event;
  }
}
