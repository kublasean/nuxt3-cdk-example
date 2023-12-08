<script setup lang="ts">
const { data } = await useFetch('/api/hello')
</script>

<template>
    <div>
        <h1>Home Page</h1>
        <p>Pre-rendered static page {{ data }}</p>
    </div>
</template>