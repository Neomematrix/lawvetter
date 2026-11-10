const rasterPracticeIcons:Record<string,string>={"intellectual-property":"/practice-icons/intellectual-property.e37c0256e941.webp","civil":"/practice-icons/civil.50c186278209.webp","labor":"/practice-icons/labor.5351e1716e14.webp","criminal-defense":"/practice-icons/criminal-defense.b564ced99294.webp","patent":"/practice-icons/patent.1a2c8ba1883d.webp","employment-law":"/practice-icons/employment-law.cc6d6fce84d2.webp","personal-injury":"/practice-icons/personal-injury.98dfc7e04875.webp","real-estate":"/practice-icons/real-estate.4cdb8e358082.webp","workers-compensation":"/practice-icons/workers-compensation.2c3710a6be5e.webp","family-law":"/practice-icons/family-law.33a49b8b65a7.webp","litigation":"/practice-icons/litigation.d034862fe422.webp","estate-planning":"/practice-icons/estate-planning.7b4beb613e58.webp","immigration":"/practice-icons/immigration.a0416d8a093f.webp","international-arbitration":"/practice-icons/international-arbitration.49c1f17d26fe.webp","aviation":"/practice-icons/aviation.9827e0fc37b4.webp","commercial-disputes":"/practice-icons/commercial-disputes.e781c6e5991e.webp","social-security-disability":"/practice-icons/social-security-disability.5fd960d75a42.webp"};
export function practiceIcon(id:string){
 if(id==='financial-law')return '/practice-icons/financial-law.svg';
 if(id==='judge')return '/practice-icons/judge.svg';
 if(/(?:^|-)entertainment(?:-|$)/.test(id))return '/practice-icons/entertainment.svg';
 if(id==='cannabis-law'||id==='cannabis')return '/practice-icons/cannabis-law.svg';
 if(/^(?:contracts?|contracts?-law)$/.test(id))return '/practice-icons/contracts.svg';
 if(/^(?:tax|taxes|tax-law|taxation|taxation-law)$/.test(id))return '/practice-icons/tax.svg';
 if(id==='employment-law'||/employment.*benefit|employee.*benefit/.test(id))return '/practice-icons/employment-benefits.svg';
 if(/^consumer(?:-|$)/.test(id))return '/practice-icons/consumer.svg';
 if(/workers?.*compensation/.test(id))return '/practice-icons/workers-compensation.2c3710a6be5e.webp';
 if(/social-security|disability/.test(id))return '/practice-icons/social-security-disability.5fd960d75a42.webp';
 if(/real-estate/.test(id))return '/practice-icons/real-estate.4cdb8e358082.webp';
 if(/(?:^|-)labor(?:-|$)/.test(id))return '/practice-icons/labor.5351e1716e14.webp';
 if(/(?:^|-)patents?(?:-|$)/.test(id))return '/practice-icons/patent.1a2c8ba1883d.webp';
 if(/international.*arbitration/.test(id))return '/practice-icons/international-arbitration.49c1f17d26fe.webp';
 if(/aviation/.test(id))return '/practice-icons/aviation.9827e0fc37b4.webp';
 if(id==='business-law')return '/practice-icons/business-law.svg';
 if(/(?:business|commercial).*disput/.test(id))return '/practice-icons/business-commercial-disputes.svg';
 if(/(?:business|commercial).*litig/.test(id))return '/practice-icons/commercial-disputes.e781c6e5991e.webp';
 if(/^civil(?:-|$)/.test(id))return '/practice-icons/civil.50c186278209.webp';
 if(/intellectual-property/.test(id))return '/practice-icons/intellectual-property.e37c0256e941.webp';
 if(/^(?:litigation|disputes?)(?:-|$)/.test(id))return '/practice-icons/litigation-disputes.svg';
 return ['estate-planning','personal-injury','family-law','litigation','criminal-defense','immigration','employment-law'].includes(id)?rasterPracticeIcons[id]:'';
}
