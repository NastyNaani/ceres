/**
 * Redirect share-extension payloads into the Scan tab.
 */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    if (url.hostname === 'expo-sharing') return '/(tabs)';
    if (url.hostname === 'scan' || url.pathname === '/scan') return '/(tabs)';
    if (url.hostname === 'history' || url.pathname === '/history' || url.pathname === '/library') {
      return '/(tabs)/history';
    }
  } catch {
    if (path.includes('expo-sharing')) return '/(tabs)';
  }
  return path;
}
