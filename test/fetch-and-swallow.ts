/** Awaits the fetch and swallows its rejection, so only the guard reports the request. */
export async function fetchAndSwallow(url: string): Promise<void> {
  try {
    await fetch(url);
  } catch {
    // Swallowed on purpose.
  }
}
