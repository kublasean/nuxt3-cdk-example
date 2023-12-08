<script setup lang="ts">
const items: globalThis.Ref<{
    hello: string;
}[]> = ref([]);

useFetch('/api/hello').then(({data}) => {
    if (data.value) {
        items.value.push(data.value);
    }
});
</script>

<template>
    <div>
        <h1>Admin page</h1>
        <p>Hello was called {{ items.length }} times</p>
        <li v-for="item in items">
            {{ item }}
        </li>
    </div>
</template>