// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },
  nitro: {
    preset: 'aws-lambda',
    serveStatic: false
  },
  css: ['~/assets/main.scss'],
  modules: ['@nuxtjs/google-fonts'],
  googleFonts: {
    families: {
      'Nunito+Sans:wght@400;900': true,
      'Syncopate:wght@400;700': true
    },
    display: 'swap'
  },

  // IMPORTANT: prerendering is NOT supported, instead use catchForeverPagePaths (below)
  routeRules: {
    // Server-side rendering turned off for admin page
    '/admin/**': { ssr: false }
  }
})