declare module '*.html' {
    const content: string
    export default content
}

declare module '*.css' {
    const content: string
    export default content
}

declare module '*.sql' {
    const content: string
    export default content
}

declare module 'cloudflare:test' {
    interface ProvidedEnv {
        DB: D1Database
        BUCKET: R2Bucket
        KV: KVNamespace
        ORDER_QUEUE: Queue
    }
}
