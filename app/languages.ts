// One shared catalog for all language pickers and server-side validation.
export const languageNames=[
 'Afrikaans','Albanian','Amharic','Arabic','Armenian','Assamese','Azerbaijani','Basque','Belarusian','Bengali','Bosnian','Bulgarian','Burmese','Cantonese','Catalan','Cebuano','Croatian','Czech','Danish','Dari','Dutch','English','Estonian','Farsi (Persian)','Finnish','French','Georgian','German','Greek','Gujarati','Haitian Creole','Hausa','Hebrew','Hindi','Hmong','Hungarian','Icelandic','Igbo','Indonesian','Irish','Italian','Japanese','Kannada','Kazakh','Khmer','Korean','Kurdish','Lao','Latvian','Lithuanian','Macedonian','Malay','Malayalam','Maltese','Mandarin Chinese','Marathi','Mongolian','Nepali','Norwegian','Odia','Pashto','Polish','Portuguese','Punjabi','Romanian','Russian','Serbian','Sinhala','Slovak','Slovenian','Somali','Spanish','Swahili','Swedish','Tagalog','Tamil','Telugu','Thai','Tibetan','Tigrinya','Turkish','Ukrainian','Urdu','Uzbek','Vietnamese','Welsh','Yiddish','Yoruba','Zulu','American Sign Language','British Sign Language'
] as const;
export const MAX_LANGUAGES=20;
export function languageKey(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ');}
const aliases:Record<string,string>={espanol:'Spanish',francais:'French',portugues:'Portuguese',deutsch:'German',italiano:'Italian',mandarin:'Mandarin Chinese',persian:'Farsi (Persian)',farsi:'Farsi (Persian)',filipino:'Tagalog',asl:'American Sign Language',bsl:'British Sign Language'};
export function languageOptions(query:string){const key=languageKey(query),alias=aliases[key];return languageNames.filter(name=>languageKey(name).includes(key)||name===alias);}
export function normalizeLanguages(value:unknown):string{
 if(value===undefined||value==='')return '';
 if(typeof value!=='string'||value.length>1000)throw Error('Choose languages from the suggestions.');
 const names=value.split(',').map(v=>v.trim()).filter(Boolean),selected=new Set<string>();
 for(const name of names){const key=languageKey(name),canonical=languageNames.find(item=>languageKey(item)===key)||aliases[key];if(!canonical)throw Error('Choose languages from the suggestions.');selected.add(canonical);}
 if(selected.size>MAX_LANGUAGES)throw Error('Choose up to '+MAX_LANGUAGES+' languages.');
 return [...selected].join(', ');
}
export function selectedLanguages(value:string|undefined|null){try{return normalizeLanguages(value||'').split(', ').filter(Boolean);}catch{return [];}}
