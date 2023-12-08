export default defineEventHandler((event) => {
    const config = useRuntimeConfig();

    if (config.app.cdnURL !== 'test') {
        throw createError({
            statusCode: 500,
            message: 'CDN URL was not set!!'
        })
    }
})