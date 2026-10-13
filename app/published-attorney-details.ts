// Transcribed from the firm biography screenshots supplied by the site owner
// on 2026-10-12. These are attributed firm statements, not a live registry check.
export function publishedAttorneyDetails(attorney:{bar_number:string;name:string;state?:string}){
 if(attorney.bar_number!=='1017061'||attorney.state!=='FL'||attorney.name!=='Helbert Lopez')return null;
 return {
  source:'https://www.floridalegaladvice.com/attorneys/helbert-lopez/',
  role:'Chief Executive Officer, Florida Law Advisers, P.A.',
  phone:'1 (800) 990-7763',email:'info@FloridaLegalAdvice.com',
  admissionYear:'2019',lawSchool:'American University Washington College of Law',
  admissions:['Florida, 2019','United States District Court, Southern District of Florida, 2025'],
  affiliations:['The Florida Bar','Family Law Section of the Florida Bar'],
  education:[
   'American University Washington College of Law, J.D., 2018',
   'Metropolitan International University, Miami, Florida, MBA in Finance, with honors, 2012',
   'Francisco José de Caldas District University, Bogotá, Colombia, B.S. in Industrial Engineering, 2006'
  ]
 };
}
