export default function AwardMethod() {
  return <section className="award-method">
    <h2>LawVetter Lawyer of the Month</h2>
    <p>Each month, LawVetter recognizes the most searched eligible lawyer in our directory. To qualify, attorneys must have an active license in good standing when selected.</p>
    <p>Recognition is free and cannot be purchased. Explore past winners by month, law firm, and location.</p>
    <p className="award-method-note">Based on LawVetter searches and Google search arrivals, not legal ability, case results, or client reviews.</p>
    <details className="award-criteria">
      <summary>View award criteria</summary>
      <p>The eligible attorney with the highest recorded search total for a completed calendar month receives the award. Monthly totals follow Eastern Time. Searches are filtered for bots and subject to daily account and network limits.</p>
      <p>Attorneys must be listed as active and in good standing in our directory when the award is finalized. Ties are resolved alphabetically by name, then by record identifier. Months with no eligible search activity receive no award.</p>
      <p>Results are finalized when the rankings or awards page is first requested after the month ends. The recipient, firm, location, result, and selection criteria are preserved as a historical record, even if profiles or rankings change later. A past award does not confirm current licensing.</p>
      <p>Awards are independent of paid placement.</p>
    </details>
  </section>;
}
