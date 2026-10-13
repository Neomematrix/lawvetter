export type PracticeGuide={name:string;description:string;intro:string;matters:string[];questions:string[];note:string};

export const practiceGuides:Record<string,PracticeGuide>={
 'personal-injury':{
  name:'Personal injury',description:'Compare Georgia personal injury lawyers, professional records, and practical questions to ask before an initial consultation.',
  intro:'A personal injury lawyer may help evaluate a claim involving an injury, identify potentially responsible parties, preserve evidence, communicate with insurers, and explain deadlines that may apply. The right fit depends on the facts, location, complexity, and the lawyer’s relevant experience.',
  matters:['Car, truck, motorcycle, bicycle, and pedestrian crashes','Unsafe property conditions and premises-liability claims','Defective-product and professional-negligence claims','Catastrophic injuries and wrongful-death claims'],
  questions:['Have you handled matters with facts like mine?','Who will work on my case and how will updates be provided?','How are fees, case costs, and expenses handled?','What records or evidence should I preserve now?'],
  note:'Deadlines vary by claim and circumstances. Consider speaking with a qualified lawyer promptly rather than relying on a general online summary.'
 },
 'family-law':{
  name:'Family law',description:'Find Georgia family lawyers and compare records for divorce, custody, support, and related family matters.',
  intro:'Family-law matters can involve finances, parenting, safety, and major changes at home. A useful first conversation should clarify the immediate problem, the county where a case may be filed, and the lawyer’s experience with similar matters.',
  matters:['Divorce, separation, and property division','Child custody, parenting plans, and visitation','Child support, alimony, and enforcement','Adoption, guardianship, and protective orders'],
  questions:['How often do you handle this kind of family matter?','What information should I bring to the first meeting?','How do you approach negotiation, mediation, and court?','How will fees and communication be managed?'],
  note:'Family-law rules and court procedures are fact-specific. Verify the lawyer’s current status and discuss your situation directly.'
 },
 'criminal-defense':{
  name:'Criminal defense',description:'Find Georgia criminal defense lawyers and compare professional records before requesting a consultation.',
  intro:'A criminal defense lawyer can explain the charge, possible consequences, available defenses, and upcoming court obligations. Time can matter when a hearing, bond issue, evidence request, or license consequence is involved.',
  matters:['Felony and misdemeanor charges','DUI and traffic-related offenses','Investigations, warrants, and pre-charge advice','Probation, appeals, and post-conviction issues'],
  questions:['How often do you handle this charge in this court?','Who will appear with me and manage the case?','What are the next deadlines or court dates?','What fee arrangement and additional costs should I expect?'],
  note:'Do not rely on directory information for urgent legal decisions. Confirm representation and deadlines directly with counsel.'
 },
 'litigation':{
  name:'Litigation',description:'Compare Georgia litigation lawyers for civil disputes, court proceedings, and negotiated resolutions.',
  intro:'Litigation covers disputes that may be resolved through negotiation, mediation, arbitration, or court. Relevant experience may depend on the subject of the dispute, the amount at issue, the court, and the stage of the case.',
  matters:['Contract and commercial disputes','Real-estate and property disputes','Business-owner and partnership conflicts','Injunctions, trials, appeals, and judgment enforcement'],
  questions:['What similar disputes have you handled?','What are the likely stages and decision points?','Who will handle discovery, hearings, and trial?','How do you budget fees and case expenses?'],
  note:'Past results do not guarantee an outcome. Compare experience, communication, staffing, and cost—not popularity alone.'
 },
 'employment-law':{
  name:'Employment law',description:'Find Georgia employment lawyers for workplace disputes and compare professional records and experience.',
  intro:'Employment lawyers may advise workers or employers about workplace rights, contracts, pay, leave, discrimination, retaliation, and separation. The right lawyer may depend on which side of the matter they represent and the agencies or courts involved.',
  matters:['Discrimination, harassment, and retaliation','Wage, overtime, leave, and classification disputes','Employment agreements and restrictive covenants','Severance, termination, and agency proceedings'],
  questions:['Do you represent employees, employers, or both?','Have you handled this issue before the relevant agency or court?','What documents and communications should I preserve?','What deadlines or internal procedures may apply?'],
  note:'Workplace claims can have short administrative deadlines. Ask a qualified lawyer about timing for your specific circumstances.'
 },
 'estate-planning':{
  name:'Estate planning',description:'Compare Georgia estate-planning lawyers for wills, trusts, probate, and planning questions.',
  intro:'Estate planning can coordinate how property is managed, who may act for you, and how family or charitable goals are documented. The work may include planning during life as well as probate or estate administration after a death.',
  matters:['Wills, trusts, and beneficiary planning','Powers of attorney and health-care directives','Probate and estate administration','Guardianship, elder-law, and tax-sensitive planning'],
  questions:['Which documents fit my goals and family situation?','How are documents maintained and updated?','What experience do you have with probate or trust administration?','What is included in the quoted fee?'],
  note:'Tax and estate-planning consequences depend on current law and individual facts. Request advice tailored to your circumstances.'
 },
 'business-law':{
  name:'Business law',description:'Find Georgia business lawyers for companies, contracts, transactions, and business disputes.',
  intro:'Business lawyers may help form and govern companies, negotiate agreements, address regulatory issues, complete transactions, and prevent or resolve disputes. Industry knowledge and the expected scope of work can be as important as location.',
  matters:['Business formation, ownership, and governance','Contracts, licensing, and commercial transactions','Purchases, sales, financing, and due diligence','Compliance, employment, and business disputes'],
  questions:['Do you regularly advise companies of this size and industry?','Who will perform the work and review key decisions?','How are project scope, fees, and changes documented?','Can you identify issues that may require another specialist?'],
  note:'A directory profile is a starting point. Confirm scope, conflicts, availability, and fees before relying on a lawyer for a transaction.'
 },
 'immigration':{
  name:'Immigration',description:'Compare Georgia immigration lawyers for visas, residency, citizenship, and related proceedings.',
  intro:'Immigration matters may involve federal agencies, consulates, employers, family members, and immigration courts. Look for experience with the specific benefit, filing, or proceeding involved—not simply immigration work in general.',
  matters:['Family- and employment-based immigration','Temporary visas and permanent residence','Citizenship and naturalization','Removal defense, waivers, and humanitarian relief'],
  questions:['How often do you handle this type of filing or proceeding?','Which lawyer or accredited team member will manage the case?','What government fees and legal fees should I expect?','How will you communicate case updates and requests for evidence?'],
  note:'Only attorneys and authorized representatives may provide immigration legal advice. Verify credentials before sharing sensitive documents.'
 },
};

