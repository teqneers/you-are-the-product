import { defineConfig } from 'wxt';

export default defineConfig({
  // Sources zip for the AMO source code review: the Safari wrapper app is not part of the Firefox build.
  zip: { excludeSources: ['safari/**'] },
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/teqneers/you-are-the-product',
    // Firefox can resolve CNAMEs, which reveals trackers disguised as subdomains of the site.
    permissions: ['webRequest', 'storage', 'tabs', ...(browser === 'firefox' ? ['dns'] : [])],
    host_permissions: ['<all_urls>'],
    action: { default_title: '__MSG_extName__' },
    web_accessible_resources: [{ resources: ['page-probe.js'], matches: ['<all_urls>'] }],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          // Permanent: AMO never allows changing it after the first upload.
          id: 'you-are-the-product@teqneers.de',
          strict_min_version: '140.0',
          // Everything stays in the browser; nothing is transmitted (AMO policy, section 6).
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
    ...(browser === 'safari' && {
      // Observe-only webRequest with request bodies and match_about_blank need Safari 18.4.
      browser_specific_settings: { safari: { strict_min_version: '18.4' } },
    }),
  }),
});
