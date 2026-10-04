/**
 * Deep-link redirects for Ceres scheme URLs.
 */
export async function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    const url = new URL(path);
    const host = (url.hostname || '').toLowerCase();
    const pathname = url.pathname || '';

    if (host === 'expo-sharing') return '/(tabs)';
    if (host === 'scan' || pathname === '/scan') return '/(tabs)';
    if (host === 'history' || pathname === '/history' || pathname === '/library') {
      return '/(tabs)/history';
    }
    if (host === 'swaps' || pathname === '/swaps') return '/(tabs)/swaps';

    // ceres://product/4088600184234  or  ceres:///product/40886…
    if (host === 'product') {
      const code = decodeURIComponent(pathname.replace(/^\//, '').split('/')[0] || '');
      if (code) return `/product/${encodeURIComponent(code)}`;
    }
    const productMatch = pathname.match(/\/product\/([^/?#]+)/i);
    if (productMatch?.[1]) {
      return `/product/${encodeURIComponent(decodeURIComponent(productMatch[1]))}`;
    }
  } catch {
    if (path.includes('expo-sharing')) return '/(tabs)';
    const bare = path.match(/(?:^|\/)product\/([^/?#]+)/i);
    if (bare?.[1]) return `/product/${encodeURIComponent(decodeURIComponent(bare[1]))}`;
  }
  return path;
}
