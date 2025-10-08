/**
 * FetchUtils Module
 * Enhanced fetch with timeout and routing support
 */

function routeUrl(url) {
  const hostname = window?.location?.hostname;

  if (url === './api/kick.php' || url.endsWith('/api/kick.php')) {
    if (typeof window !== 'undefined' && hostname && hostname.includes('lazyinvoice.app')) {
      return 'https://lazyinvoice.app/kick';
    }
  }

  return url;
}

export async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const routedUrl = routeUrl(url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const originalSignal = options?.signal;
  if (originalSignal) {
    if (originalSignal.aborted) {
      controller.abort();
    } else {
      originalSignal.addEventListener('abort', () => controller.abort());
    }
  }

  try {
    const requestOptions = {
      ...options,
      signal: controller.signal
    };

    const response = await fetch(routedUrl, requestOptions);
    clearTimeout(timeoutId);

    return response;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      if (originalSignal?.aborted) {
        throw error;
      }
      throw new Error('請求超時（10秒）');
    }

    const enhancedError = new Error(`Fetch 失敗: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.requestUrl = routedUrl;
    enhancedError.originalUrl = url;

    throw enhancedError;
  }
}