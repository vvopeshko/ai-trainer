import { defineConfig } from 'astro/config'
import sitemap from '@astrojs/sitemap'

// Главная — статический public/index.html (портированный лендинг), Astro о ней
// не знает → добавляем в sitemap через customPages.
export default defineConfig({
  site: 'https://gymwithai.me',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      customPages: ['https://gymwithai.me/'],
    }),
  ],
})
