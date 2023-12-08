export default defineEventHandler(async (event) => {

    await new Promise(resolve => setTimeout(resolve, 5000));    

    return {
        hello: 'world'
    }
})
  