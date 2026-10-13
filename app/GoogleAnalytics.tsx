const measurementId=(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID||'').trim();
const enabled=/^G-[A-Z0-9]+$/i.test(measurementId);

export default function GoogleAnalytics(){
 if(!enabled)return null;
 return <>
  <script async src={'https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(measurementId)}/>
  <script dangerouslySetInnerHTML={{__html:`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(measurementId)},{anonymize_ip:true});`}}/>
 </>;
}

