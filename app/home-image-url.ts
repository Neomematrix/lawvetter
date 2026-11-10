// Vinext/Next static imports carry metadata; Vite-only tooling may return a URL.
export function imageSource(image:string|{src:string}){return typeof image==='string'?image:image.src;}
