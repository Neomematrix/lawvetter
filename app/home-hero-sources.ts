import hero from './home-images/hero-fc9f5622653c1ad5.webp';
const imageSource=(image:string|{src:string})=>typeof image==='string'?image:image.src;
export const heroSources=imageSource(hero)+' 640w';
