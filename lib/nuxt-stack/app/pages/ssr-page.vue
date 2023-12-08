<script setup lang="ts">

/*const items: globalThis.Ref<{
    hello: string;
}[]> = ref([]);*/

export type HelloArray = {
    hello: string
}[];

const items = useState<HelloArray>('items', () => []);

async function addHello() {


    console.log("add hello start");
    const data = await $fetch('/api/hello');
    console.log(data);
    if (data) {
        items.value.push(data);
    }
    console.log(items);
    console.log("add hello end");
}

await useLazyAsyncData('hello', addHello);

</script>

<template>
    <div>
        <h1>SSR page</h1>
        <p>Hello was called {{ items.length }} times</p>
        <li v-for="item in items">
            {{ item }}
        </li>
    </div>
</template>