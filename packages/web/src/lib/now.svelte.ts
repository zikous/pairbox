let now = $state(Date.now());
setInterval(() => (now = Date.now()), 1_000);

/** The current time, updated every second: read it in templates for live countdowns. */
export const clock = {
  get now() {
    return now;
  },
};
