// One distinct source photograph per published practice category.
const dedicatedPhotos:Record<string,string>={
 'tax':'tax',
 'judge':'judge',
 'patent':'patent',
 'labor':'labor',
 'international-arbitration':'international-arbitration',
 'civil-litigation':'civil-litigation',
 'commercial-litigation':'commercial-litigation',
 'business-and-commercial-disputes':'business-and-commercial-disputes',
 'litigation-and-disputes':'litigation-and-disputes',
};
export function practiceBannerImage(id:string):string {
 if(dedicatedPhotos[id])return '/practice-banners/'+dedicatedPhotos[id]+'.webp';
 let photo='courthouse';
 if(/family|adoption|custody|divorce|domestic/.test(id))photo='family';
 else if(/estate-planning|probate|elder|trust|wills/.test(id))photo='estate';
 else if(/immigration|citizenship|visa/.test(id))photo='immigration';
 else if(/personal-injury|accident|motor|traffic/.test(id))photo='personal-injury';
 else if(/workers?.*compensation|construction|labor/.test(id))photo='workers';
 else if(/social-security|disability/.test(id))photo='disability';
 else if(/employment|employee|benefits/.test(id))photo='employment';
 else if(/aviation/.test(id))photo='aviation';
 else if(/real-estate|property|landlord|tenant|land-use/.test(id)&&!id.includes('intellectual'))photo='real-estate';
 else if(/financial|bankrupt|debt|tax|securities|banking/.test(id))photo='finance';
 else if(/entertainment|music|media|sports/.test(id))photo='entertainment';
 else if(/cannabis|hemp/.test(id))photo='cannabis';
 else if(/patent|intellectual|technology|copyright|trademark/.test(id))photo='invention';
 else if(/criminal|dui|criminal-defense/.test(id))photo='criminal-defense';
 else if(/consumer/.test(id))photo='consumer';
 else if(/contract|arbitration|mediation|international/.test(id))photo='contracts';
 else if(/business|corporate|commercial/.test(id)&&!/(litigation|disputes)/.test(id))photo='business';
 return '/practice-banners/'+photo+'.webp';
}
