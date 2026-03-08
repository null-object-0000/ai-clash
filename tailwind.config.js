/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{vue,js,ts,jsx,tsx}" // 确保扫描了 src 下所有的 vue 文件
    ],
    theme: {
        extend: {},
    },
    plugins: [],
}