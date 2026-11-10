import './local-attorney-guide.css';

export default function LocalAttorneyGuide({city,questions}:{city:string;questions?:string[]}){
 return <section className="local-attorney-guide" aria-labelledby="local-guide-title">
  <header className="local-guide-heading"><p className="section-kicker">BEFORE YOU CHOOSE</p><h2 id="local-guide-title">Make your first conversation count</h2><p>A few questions can help you compare attorneys and decide who fits your needs.</p></header>
  <div className={'local-guide-layout'+(!questions?.length?' local-guide-shortlist-only':'')}>
   {!!questions?.length&&<section className="local-guide-questions" aria-labelledby="local-questions-title"><header><h3 id="local-questions-title">Questions for your {city} attorney</h3><p>Use these as a starting point for your consultation.</p></header><ol>{questions.slice(0,4).map((question,index)=><li key={question}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span><p>{question}</p></li>)}</ol><div className="local-guide-tip"><strong>Check local experience</strong><p>Ask whether the attorney handles matters in your county and the court relevant to your case.</p></div></section>}
   <aside className="local-guide-shortlist" aria-labelledby="local-shortlist-title"><p className="section-kicker">COMPARE YOUR OPTIONS</p><h3 id="local-shortlist-title">Build a useful shortlist</h3><p>Keep a few names and compare what matters to you.</p><ul><li><strong>Relevant experience</strong><span>Look for experience with your type of matter.</span></li><li><strong>Communication & availability</strong><span>Ask who will handle your case and how you’ll receive updates.</span></li><li><strong>Clear fee terms</strong><span>Compare written fees, expected costs, and what is included.</span></li></ul><a className="gold-button" href="/?view=shortlist">Open your shortlist <span aria-hidden="true">→</span></a><p className="local-guide-context">Verified client reviews add context. Search rankings reflect interest, rather than legal ability.</p></aside>
  </div>
  <p className="local-guide-disclosure">Location and practice listings describe directory information. They do not represent a recommendation or guarantee of results.</p>
 </section>;
}
