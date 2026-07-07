/** Rewrite lr4xt.com asset URLs to local static server paths */
export function rewriteSiteUrls(html: string): string {
  return html
    .replace(/https:\/\/lr4xt\.com\//g, '/api/assets/')
    .replace(/src="\/post-images\//g, 'src="/api/assets/post-images/')
    .replace(/url\('\/post-images\//g, "url('/api/assets/post-images/")
    .replace(/url\("\/post-images\//g, 'url("/api/assets/post-images/');
}

export function rewriteSiteUrl(url: string): string {
  if (url.startsWith('https://lr4xt.com/')) {
    return url.replace('https://lr4xt.com/', '/api/assets/');
  }
  if (url.startsWith('/post-images/')) {
    return `/api/assets${url}`;
  }
  return url;
}
